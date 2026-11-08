# Task 2: AI-Powered Plain-English-to-Test Automation

An enterprise-grade, generic test automation platform built with **TypeScript**, **Node.js**, **Playwright**, and **Zod** that translates natural-language test cases into structured execution plans and runs them in a real browser with strict semantic locators, ambiguity prevention, and real-time reporting.

---

## 1. Architectural Pipeline

```
 Plain-English Test Case (e.g. "Log in as a customer and verify dashboard")
                                  |
                                  v
                        +-------------------+
                        |  AI Test Planner  |
                        | (Gemini / OpenAI  |
                        |   or Heuristic)   |
                        +-------------------+
                                  |
                                  v
                    Structured JSON Test Plan
                                  |
                                  v
                        +-------------------+
                        |  Plan Validation  |
                        |  (Strict Zod)     |
                        +-------------------+
                                  |
                                  v
                        +-------------------+
                        | Playwright Engine |
                        | (Semantic Locators|
                        | & Ambiguity Guard)|
                        +-------------------+
                                  |
                                  v
                        +-------------------+
                        | Assertion Engine  |
                        | (Visible, Text,   |
                        |   URL Checks)     |
                        +-------------------+
                                  |
                                  v
                    Detailed Report + Screenshots
                  (JSON + Terminal Summary + Web UI)
```

### Key Modules

- **`src/validation/testPlanSchema.ts`**: Strict Zod schemas defining allowed actions (`navigate`, `click`, `fill`, `select`, `check`, `uncheck`, `press`, `wait_for`, `assert_visible`, `assert_text`, `assert_url`) and semantic locator targets (`role`, `name`, `label`, `placeholder`, `text`, `fallbackSelector`). **Arbitrary code or JavaScript execution is strictly prohibited and rejected.**
- **`src/planner/`**:
  - `aiPlanner.ts`: Pluggable multi-provider engine supporting **Gemini** (`@google/genai`), **OpenAI**, and **Heuristic fallback**.
  - `heuristicPlanner.ts`: Deterministic, zero-dependency offline NLP planner that allows instant local evaluation without requiring external paid API keys.
- **`src/locators/smartLocator.ts`**:
  - Prioritizes Playwright semantic primitives: `getByRole()`, `getByLabel()`, `getByPlaceholder()`, `getByText()`.
  - Performs pre-interaction checks: Existence, Visibility, Enabled status.
  - **Ambiguity Guard**: When a locator matches multiple elements, checks if only one is visible. If multiple visible elements match, it halts execution and throws an `Ambiguity Error` instead of randomly clicking.
- **`src/executor/playwrightExecutor.ts`**: Coordinates browser lifecycle (Chrome/Chromium), step execution, live event emission, assertion evaluation, and failure screenshot capture.
- **`src/reporting/reportGenerator.ts`**: Generates timestamped JSON execution reports and colored ANSI terminal tables.
- **`src/server/index.ts` & `frontend/`**: Full-stack web application with Server-Sent Events (SSE) streaming progress, live logs, test plan inspector, and screenshot preview.

---

## 2. Supported Actions & Plan Schema

Every action is validated against a strict Zod discriminated union:

| Action | Parameters | Description |
|---|---|---|
| `navigate` | `url: string` | Navigates the browser to the target URL. |
| `click` | `target: LocatorTarget` | Clicks on a semantically resolved element. |
| `fill` | `target: LocatorTarget, value: string` | Fills text into an input field or textarea. |
| `select` | `target: LocatorTarget, value: string` | Selects an option in a `<select>` or combobox. |
| `check` | `target: LocatorTarget` | Checks a checkbox or radio button. |
| `uncheck` | `target: LocatorTarget` | Unchecks a checkbox. |
| `press` | `target: LocatorTarget, key: string` | Presses a keyboard key (e.g. `Enter`). |
| `wait_for` | `timeout?: number, state?: 'visible' \| 'hidden'` | Explicit wait for time or element state. |
| `assert_visible` | `target: LocatorTarget` | Asserts an element is visible in the viewport. |
| `assert_text` | `target: LocatorTarget, expectedText: string, exact?: boolean` | Asserts element text content. |
| `assert_url` | `url?: string, contains?: string` | Asserts current page URL. |

### Sample Validated Plan

```json
{
  "baseUrl": "https://the-internet.herokuapp.com/login",
  "testDescription": "Log in with username tomsmith and verify secure dashboard",
  "steps": [
    { "action": "navigate", "url": "https://the-internet.herokuapp.com/login" },
    { "action": "fill", "target": { "role": "textbox", "name": "username", "label": "Username" }, "value": "tomsmith" },
    { "action": "fill", "target": { "role": "textbox", "name": "password", "label": "Password" }, "value": "SuperSecretPassword!" },
    { "action": "click", "target": { "role": "button", "name": "Login" } },
    { "action": "assert_url", "contains": "/secure" },
    { "action": "assert_visible", "target": { "role": "heading", "name": "Secure Area" } }
  ]
}
```

---

## 3. Generic Website Support & PHPTRAVELS Realities

The application is completely generic and accepts any website URL and plain-English prompt.

### PHPTRAVELS Demo Access Exploration (`https://phptravels.com/demo`)
When executing the PHPTRAVELS test case:
- The planner generates steps to navigate to the demo page, discover the demo access form (First Name, Last Name, Business Name, Work Email), and submit fictional details.
- **Truthful Diagnostic Reporting**: In real-world environments, PHPTRAVELS employs dynamic math security checks, disposable email blockers, and honeypots. The framework reports the exact outcome (e.g. elements located, verification challenge detected) rather than faking a pass or guessing credentials.

---

## 4. Setup and Execution Instructions

### Prerequisites
- Node.js v18+ or v20+
- Google Chrome or Playwright Chromium

### Installation
```bash
npm install
```

### Configuration via `.env`
Copy `.env.example` to `.env`:
```bash
# Provider: 'heuristic' (zero API keys needed), 'gemini', or 'openai'
LLM_PROVIDER=heuristic

# Optional API Keys
GEMINI_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here

# Browser settings
HEADLESS=true
PORT=3000
```

### Running the Test Suite (15 Comprehensive Tests)
```bash
npm test
```
The test suite executes:
- **Suite 1**: Zod plan validation and malicious script rejection.
- **Suite 2**: Natural-language planning for unseen instructions.
- **Suite 3**: Generic website live execution (`example.com`).
- **Suite 3B**: Complete login authentication flow (`the-internet.herokuapp.com/login`).
- **Suite 4**: Intentionally failing test verifying screenshot capture and failure status.
- **Suite 5**: PHPTRAVELS customer demo scenario.

### Running via CLI Runner
```bash
npm start -- --url="https://the-internet.herokuapp.com/login" --test="Login with username tomsmith and password SuperSecretPassword! and verify secure area"
```

### Launching the Web UI
```bash
npm run server
```
Open **`http://localhost:3000`** in your browser to access the graphical test automation interface with live progress streaming, JSON plan viewer, and screenshot previews.

---

## 5. Sample Execution Output

```
================================================================================
              AI-POWERED PLAYWRIGHT TEST AUTOMATION REPORT                     
================================================================================
 Test Case   : Login with username tomsmith and password SuperSecretPassword! and verify secure area
 Target URL  : https://the-internet.herokuapp.com/login
 Start Time  : 2026-11-06T09:08:44.668Z
 Duration   : 8.05s
 Status      : PASS [ALL STEPS EXECUTED SUCCESSFULLY]
--------------------------------------------------------------------------------
Step   | Action         | Duration   | Status | Details
--------------------------------------------------------------------------------
1      | navigate       | 2819ms     | PASS   | page.goto('https://the-internet.herokuapp.com/login')
2      | wait_for       | 3010ms     | PASS   | page.waitForTimeout(3000)
3      | fill           | 98ms       | PASS   | getByRole('textbox', { name: 'username' }) (Count=1, Visible=true, Enabled=true)
4      | fill           | 41ms       | PASS   | getByRole('textbox', { name: 'password' }) (Count=1, Visible=true, Enabled=true)
5      | click          | 721ms      | PASS   | getByRole('button', { name: 'Login' }) (Count=1, Visible=true, Enabled=true)
6      | assert_visible | 62ms       | PASS   | getByRole('heading', { name: 'Secure Area' }) (Count=1, Visible=true, Enabled=true)

 Final Screenshot   : screenshots/success_final_2026-11-06T09-08-52-284Z.png
================================================================================
```

---

## 6. Limitations & Future Improvements

1. **Third-Party CAPTCHAs & Bot Gates**: Modern bot mitigation systems (e.g. Cloudflare Turnstile, reCAPTCHA v3) intentionally prevent automated access. As per ethical and technical guidelines, the framework does not attempt bypasses and accurately surfaces the block to the user.
2. **Multi-Tab Orchestration**: Future versions can expand the plan schema to support multi-tab and popup window switching.
3. **Visual Regression Diffs**: Adding pixel-by-pixel visual diffing alongside text and role assertions would enhance UI fidelity checks.

