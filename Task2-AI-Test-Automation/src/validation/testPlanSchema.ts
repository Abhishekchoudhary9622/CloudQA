import { z } from 'zod';

/**
 * Semantic locator definition using Playwright accessibility and content primitives.
 */
export const LocatorTargetSchema = z.object({
  role: z.enum([
    'button',
    'link',
    'textbox',
    'combobox',
    'radio',
    'checkbox',
    'heading',
    'tab',
    'alert',
    'img',
    'searchbox',
    'option'
  ]).optional(),
  name: z.string().optional(),
  label: z.string().optional(),
  placeholder: z.string().optional(),
  text: z.string().optional(),
  fallbackSelector: z.string().optional()
}).refine(data => !!(data.role || data.label || data.placeholder || data.text || data.fallbackSelector), {
  message: "Target must specify at least one locator criterion (role, label, placeholder, text, or fallbackSelector)."
});

export type LocatorTarget = z.infer<typeof LocatorTargetSchema>;

/**
 * Base action step schemas
 */
const NavigateStepSchema = z.object({
  action: z.literal('navigate'),
  url: z.string().min(1, "A valid URL or variable is required for the navigate action.")
});

const ClickStepSchema = z.object({
  action: z.literal('click'),
  target: LocatorTargetSchema,
  timeout: z.number().positive().optional()
});

const FillStepSchema = z.object({
  action: z.literal('fill'),
  target: LocatorTargetSchema,
  value: z.string(),
  timeout: z.number().positive().optional()
});

const SelectStepSchema = z.object({
  action: z.literal('select'),
  target: LocatorTargetSchema,
  value: z.string(),
  timeout: z.number().positive().optional()
});

const CheckStepSchema = z.object({
  action: z.literal('check'),
  target: LocatorTargetSchema,
  timeout: z.number().positive().optional()
});

const UncheckStepSchema = z.object({
  action: z.literal('uncheck'),
  target: LocatorTargetSchema,
  timeout: z.number().positive().optional()
});

const PressStepSchema = z.object({
  action: z.literal('press'),
  target: LocatorTargetSchema,
  key: z.string(),
  timeout: z.number().positive().optional()
});

const WaitForStepSchema = z.object({
  action: z.literal('wait_for'),
  target: LocatorTargetSchema.optional(),
  timeout: z.number().positive().optional(),
  state: z.enum(['visible', 'hidden', 'attached', 'detached']).optional()
});

const AssertVisibleStepSchema = z.object({
  action: z.literal('assert_visible'),
  target: LocatorTargetSchema,
  timeout: z.number().positive().optional()
});

const AssertTextStepSchema = z.object({
  action: z.literal('assert_text'),
  target: LocatorTargetSchema,
  expectedText: z.string(),
  exact: z.boolean().optional(),
  timeout: z.number().positive().optional()
});

const AssertUrlStepSchema = z.object({
  action: z.literal('assert_url'),
  url: z.string().optional(),
  contains: z.string().optional(),
  timeout: z.number().positive().optional()
});

const ExtractStepSchema = z.object({
  action: z.literal('extract'),
  target: LocatorTargetSchema.optional(),
  source: z.enum(['text', 'attribute', 'url']).optional(),
  attributeName: z.string().optional(),
  variableName: z.string().min(1, "variableName is required"),
  pattern: z.string().optional(),
  timeout: z.number().positive().optional()
});

/**
 * Discriminated union of all supported actions
 */
export const TestStepSchema = z.discriminatedUnion('action', [
  NavigateStepSchema,
  ClickStepSchema,
  FillStepSchema,
  SelectStepSchema,
  CheckStepSchema,
  UncheckStepSchema,
  PressStepSchema,
  WaitForStepSchema,
  AssertVisibleStepSchema,
  AssertTextStepSchema,
  AssertUrlStepSchema,
  ExtractStepSchema
]);

export type TestStep = z.infer<typeof TestStepSchema>;

/**
 * Complete structured test plan schema
 */
export const TestPlanSchema = z.object({
  baseUrl: z.string().url("baseUrl must be a valid HTTP or HTTPS URL."),
  testDescription: z.string().min(3, "testDescription must describe the test case."),
  steps: z.array(TestStepSchema).min(1, "A test plan must contain at least one step.")
});

export type TestPlan = z.infer<typeof TestPlanSchema>;

/**
 * Helper to validate a JSON object against the schema
 */
export function validateTestPlan(rawPlan: unknown): { success: true; data: TestPlan } | { success: false; errors: string[] } {
  const result = TestPlanSchema.safeParse(rawPlan);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
    return { success: false, errors };
  }
}
