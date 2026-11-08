import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { loadConfig } from '../config/environment';
import { AiPlanner } from '../planner/aiPlanner';
import { generateInterpretation } from '../planner/interpretation';
import { PlaywrightExecutor } from '../executor/playwrightExecutor';
import { ReportGenerator } from '../reporting/reportGenerator';
import { validateTestPlan } from '../validation/testPlanSchema';

const app = express();
const config = loadConfig();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static frontend files
const frontendDir = path.resolve(__dirname, '../../frontend');
app.use(express.static(frontendDir));

// Serve test fixtures
const fixturesDir = path.resolve(__dirname, '../../tests/fixtures');
app.use('/fixtures', express.static(fixturesDir));

// Serve screenshots directory
app.use('/screenshots', express.static(config.screenshotsDir));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    provider: config.llmProvider,
    port: config.serverPort,
    headless: config.headless,
    screenshotsDir: config.screenshotsDir,
    reportsDir: config.reportsDir
  });
});

// Explicit route to serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

// Endpoint 1: Generate Plan & Interpretation (Without Running)
app.post('/api/plan', async (req, res) => {
  try {
    const { url, testCase } = req.body;
    if (!url || !testCase) {
      return res.status(400).json({ error: 'url and testCase are required' });
    }

    const planner = new AiPlanner(config);
    const plan = await planner.plan(url, testCase);
    const interpretation = generateInterpretation(plan);

    return res.json({ success: true, plan, interpretation });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint 2: Full Plan + Execute with Server-Sent Events (SSE) for live streaming
app.get('/api/run-stream', async (req, res) => {
  const url = req.query.url as string;
  const testCase = req.query.testCase as string;
  const planJson = req.query.planJson as string;
  const timeoutParam = req.query.timeout ? parseInt(req.query.timeout as string, 10) : undefined;
  const headlessParam = req.query.headless !== undefined ? req.query.headless === 'true' : undefined;
  const categoryParam = (req.query.category as string) || 'Functional';

  if (!planJson && (!url || !testCase)) {
    return res.status(400).send('Either planJson or url and testCase query parameters are required');
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (event: any) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    let plan: any;

    if (planJson) {
      try {
        const raw = JSON.parse(planJson);
        const val = validateTestPlan(raw);
        if (!val.success) {
          throw new Error(`Plan validation failed: ${val.errors.join('; ')}`);
        }
        plan = val.data;
        sendEvent({ type: 'log', message: 'Executing pre-validated test plan from editor...' });
      } catch (pe: any) {
        throw new Error(`Invalid plan JSON provided: ${pe.message}`);
      }
    } else {
      sendEvent({ type: 'log', message: `Synthesizing test plan with AI (${config.llmProvider})...` });
      const planner = new AiPlanner(config);
      plan = await planner.plan(url, testCase);
    }

    const interpretation = generateInterpretation(plan);
    sendEvent({ type: 'plan_ready', plan, interpretation });
    sendEvent({ type: 'log', message: `Test plan verified with ${plan.steps.length} actions. Launching browser...` });

    const executor = new PlaywrightExecutor(config);
    const report = await executor.execute(
      plan,
      evt => sendEvent(evt),
      { timeout: timeoutParam, headless: headlessParam, category: categoryParam }
    );

    const reporter = new ReportGenerator(config);
    reporter.saveJsonReport(report);

    // Map screenshot paths to web URLs
    if (report.screenshotOnFailure) {
      report.screenshotOnFailure = `/screenshots/${path.basename(report.screenshotOnFailure)}`;
    }
    if (report.finalScreenshot) {
      report.finalScreenshot = `/screenshots/${path.basename(report.finalScreenshot)}`;
    }
    if (report.initialScreenshot) {
      report.initialScreenshot = `/screenshots/${path.basename(report.initialScreenshot)}`;
    }
    for (const s of report.steps) {
      if (s.screenshotPath) {
        s.screenshotPath = `/screenshots/${path.basename(s.screenshotPath)}`;
      }
    }

    sendEvent({ type: 'complete', report, interpretation });
    res.end();
  } catch (err: any) {
    sendEvent({ type: 'error', error: err.message });
    res.end();
  }
});

// Endpoint 3: Standard POST execute (Supports both prompt and pre-built plan)
app.post('/api/run', async (req, res) => {
  try {
    const { url, testCase, plan: providedPlan, timeout, headless, category } = req.body;

    let plan = providedPlan;
    if (!plan) {
      if (!url || !testCase) {
        return res.status(400).json({ error: 'Either plan or (url and testCase) are required' });
      }
      const planner = new AiPlanner(config);
      plan = await planner.plan(url, testCase);
    } else {
      const val = validateTestPlan(plan);
      if (!val.success) {
        return res.status(400).json({ error: `Invalid plan schema: ${val.errors.join('; ')}` });
      }
      plan = val.data;
    }

    const interpretation = generateInterpretation(plan);
    const executor = new PlaywrightExecutor(config);
    const report = await executor.execute(plan, undefined, { timeout, headless, category });

    const reporter = new ReportGenerator(config);
    reporter.saveJsonReport(report);

    // Web-friendly screenshot paths
    if (report.screenshotOnFailure) {
      report.screenshotOnFailure = `/screenshots/${path.basename(report.screenshotOnFailure)}`;
    }
    if (report.finalScreenshot) {
      report.finalScreenshot = `/screenshots/${path.basename(report.finalScreenshot)}`;
    }
    if (report.initialScreenshot) {
      report.initialScreenshot = `/screenshots/${path.basename(report.initialScreenshot)}`;
    }
    for (const s of report.steps) {
      if (s.screenshotPath) {
        s.screenshotPath = `/screenshots/${path.basename(s.screenshotPath)}`;
      }
    }

    return res.json({ success: true, report, interpretation });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint 4: List past execution reports with metadata for history & comparison
app.get('/api/reports', (req, res) => {
  try {
    if (!fs.existsSync(config.reportsDir)) {
      return res.json({ reports: [] });
    }
    const files = fs.readdirSync(config.reportsDir)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, 60);

    const reports = files.map(f => {
      try {
        const content = fs.readFileSync(path.join(config.reportsDir, f), 'utf-8');
        const data = JSON.parse(content);
        return {
          filename: f,
          testDescription: data.testDescription || 'Automated Test',
          baseUrl: data.baseUrl || '',
          overallStatus: data.overallStatus || 'UNKNOWN',
          totalDurationMs: data.totalDurationMs || 0,
          startTime: data.startTime || '',
          stepsCount: data.steps ? data.steps.length : 0,
          assertionsPassed: data.assertionsPassed || 0,
          assertionsFailed: data.assertionsFailed || 0,
          category: data.category || 'Functional',
          data
        };
      } catch {
        return null;
      }
    }).filter(Boolean);

    return res.json({ reports });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Endpoint 5: Get specific report by filename
app.get('/api/reports/:filename', (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const fullPath = path.join(config.reportsDir, filename);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Report not found' });
    }
    const content = fs.readFileSync(fullPath, 'utf-8');
    return res.json({ success: true, report: JSON.parse(content) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Endpoint 6: Task 1 Self-Healing Selenium Reports (C# Multi-Heuristic Scoring Diagnostics)
app.get('/api/task1/reports', (req, res) => {
  try {
    const task1ReportsDir = path.resolve(__dirname, '../../../Task1-SelfHealing-Selenium/Reports');
    if (!fs.existsSync(task1ReportsDir)) {
      return res.json({ available: false, reports: [] });
    }

    const files = fs.readdirSync(task1ReportsDir)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, 10);

    const reports = files.map(f => {
      try {
        const content = fs.readFileSync(path.join(task1ReportsDir, f), 'utf-8');
        return { filename: f, data: JSON.parse(content) };
      } catch {
        return null;
      }
    }).filter(Boolean);

    return res.json({ available: reports.length > 0, reports });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

const PORT = config.serverPort;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n========================================================`);
  console.log(` AI-Powered Test Automation Server Running`);
  console.log(` Web UI: http://localhost:${PORT}`);
  console.log(` LLM Provider: ${config.llmProvider}`);
  console.log(` Headless: ${config.headless}`);
  console.log(`========================================================\n`);
});
