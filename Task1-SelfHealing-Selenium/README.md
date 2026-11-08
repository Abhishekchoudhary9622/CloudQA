# Task 1: Self-Healing Web Automation Using C# and Selenium

A resilient, enterprise-grade browser automation framework built on **.NET 8** and **Selenium WebDriver** designed to dynamically identify, interact with, and verify web form elements on [CloudQA Automation Practice Form](https://app.cloudqa.io/home/AutomationPracticeForm) without relying exclusively on brittle selectors (fixed XPath, CSS selectors, hardcoded IDs, or class names).

---

## 1. Architectural Overview

```
                      +-----------------------------+
                      | Target Web Page (DOM Tree)  |
                      +-----------------------------+
                                     |
                                     v
                      +-----------------------------+
                      | Candidate Extraction Engine |
                      | (Tag, Role, Label, Context) |
                      +-----------------------------+
                                     |
                                     v
                      +-----------------------------+
                      |   Heuristic Scoring Engine  |
                      |  - Label Similarity         |
                      |  - W3C Accessible Name      |
                      |  - Type Compatibility       |
                      |  - Visibility & Enabled     |
                      |  - Semantic Context         |
                      |  - Nearby Proximity Text    |
                      +-----------------------------+
                                     |
                                     v
                      +-----------------------------+
                      |   Decision & Health Engine  |
                      |  - Score >= MinThreshold    |
                      |  - Ambiguity Margin Check   |
                      |  - Explicit Fallback        |
                      +-----------------------------+
                                     |
              +----------------------+----------------------+
              |                                             |
              v                                             v
     [Single Winner >= 0.65]                      [Ambiguity / Tied Top]
              |                                             |
              v                                             v
     Execute Action & Verify                    Throw AmbiguousMatchException
     (SendKeys, Select, Radio)                  (Detailed Diagnostic Output)
              |
              v
     Execution Report + Screenshots
```

### Core Architecture Components

- **`Configuration/`**: Strongly typed options (`AutomationOptions.cs`) loaded hierarchically from `appsettings.json`, `.env` files, environment variables (`TARGET_URL`, `FIRST_NAME`, `GENDER`, `STATE`, `HEADLESS`), and command-line arguments (`--url`, `--headless`).
- **`Locators/`**:
  - `HeuristicLocatorEngine.cs`: Orchestrates candidate extraction, evaluation across all scorers, composite score calculation, ambiguity validation, and fallback handling.
  - `IElementScorer.cs`: Pluggable scoring strategy contract.
  - `Scorers/`:
    - `LabelSimilarityScorer`: Matches `<label for="...">`, parent `<label>`, and sibling tags.
    - `AccessibleNameScorer`: Computes accessible names following the W3C AccName 1.2 specification (`aria-label`, `aria-labelledby`, native labels, placeholders).
    - `ElementTypeCompatibilityScorer`: Enforces strict type validity (e.g. text inputs reject radio/select controls).
    - `VisibilityEnabledScorer`: Ensures elements are physically displayed in the viewport and enabled.
    - `SemanticContextScorer`: Assesses parent container context (`.form-group`, `fieldset`, `<legend>`, tables).
    - `NearbyLabelScorer`: Analyzes preceding/following sibling text nodes.
  - `TextSimilarity.cs`: Damerau-Levenshtein distance, token Jaccard similarity, and antonym recognition (differentiating "Male" vs "Female").
  - `Exceptions/`: `AmbiguousElementMatchException` and `ElementNotFoundException`.
- **`Services/`**:
  - `WebDriverFactory.cs`: Configures ChromeDriver with security sandboxing, headless support, and anti-detection flags.
  - `FormAutomationService.cs`: Coordinates the 10-step end-to-end automation workflow.
  - `ScreenshotService.cs`: Captures step-by-step and failure diagnostic screenshots.
  - `ReportingService.cs`: Generates structured JSON reports and ANSI-colored terminal summaries.

---

## 2. Self-Healing Scoring Engine

For each candidate element $E$ in the DOM, the total confidence score $S(E)$ is computed as a normalized weighted sum:

$$S(E) = \frac{\sum_{i} W_i \cdot s_i(E)}{\sum_{i} W_i}$$

### Default Weight Configuration

| Scorer | Weight ($W_i$) | Description |
|---|---|---|
| **Label Similarity** | `0.30` | Matches associated `<label for>`, parent `<label>`, or option labels. |
| **Accessible Name** | `0.25` | Follows W3C Accessible Name computation (ARIA attributes + native label). |
| **Element Type Compatibility** | `0.20` | Strict compatibility filter (e.g. text input vs radio vs select). |
| **Semantic Context** | `0.10` | Parent container text, `<legend>`, `.form-group` headings. |
| **Nearby Label** | `0.10` | Proximity sibling text and inline descriptors. |
| **Visibility & Enabled** | `0.05` | Binary multiplier; hidden elements are disqualified. |

### Hard Invalidation Rules
1. **Type Incompatibility**: If `ElementTypeCompatibility == 0.0`, total score is immediately forced to `0.0`.
2. **Hidden/Disabled Elements**: Elements with `IsDisplayed == false` or `IsEnabled == false` receive `0.0` to prevent interacting with hidden DOM or template slots.
3. **Radio Option Value Guard**: When targeting an option (e.g., `"Male"` under `"Gender"`), candidates whose explicit value or label contradicts the option (e.g., `"Female"`) receive `0.0`.
4. **Slotted Web Components**: Slotted demo templates are penalized by `-0.20` relative to active light-DOM form controls.

---

## 3. Ambiguity Detection & Prevention

A critical flaw in many self-healing frameworks is **random guessing** when multiple elements match. This framework implements a strict **Ambiguity Detection Guard**:

```csharp
if (first.TotalConfidenceScore >= options.MinConfidenceThreshold &&
    second.TotalConfidenceScore >= options.MinConfidenceThreshold)
{
    var diff = first.TotalConfidenceScore - second.TotalConfidenceScore;
    if (diff < options.AmbiguityMarginThreshold) // Default: 0.08
    {
        throw new AmbiguousElementMatchException(fieldKey, first, second, diff, options.AmbiguityMarginThreshold);
    }
}
```

If two candidates both exceed the confidence threshold and their difference is within the `AmbiguityMarginThreshold` (0.08), the framework **refuses to guess** and throws `AmbiguousElementMatchException` with detailed diagnostics showing candidate IDs, tags, labels, and exact score breakdowns.

---

## 4. Fields Automated

Target URL: `https://app.cloudqa.io/home/AutomationPracticeForm`

1. **First Name** (Textbox): Dynamically discovered via accessible label and type matching. Value entered: `Abhishek`.
2. **Gender** (Radio Button): Dynamically located by group context (`Gender`) and option label/value (`Male`). Value selected: `Male`.
3. **State** (Dropdown): Dynamically located by label (`State`) and `<select>` semantics. Option selected: `United States`.

> [!NOTE]
> The automation does NOT click Submit, Reset, or Cancel, adhering strictly to the assignment specifications.

---

## 5. Setup and Execution Instructions

### Prerequisites
- .NET 8.0 SDK or .NET 10 SDK (installed)
- Google Chrome browser (v120+)

### Configuration via Environment Variables or `.env`

Copy `.env.example` to `.env` or set environment variables:
```bash
TARGET_URL=https://app.cloudqa.io/home/AutomationPracticeForm
FIRST_NAME=Abhishek
GENDER=Male
STATE=United States
HEADLESS=true
MIN_CONFIDENCE=0.65
AMBIGUITY_MARGIN=0.08
```

### Running the Automation Console CLI

Run in headless mode:
```bash
dotnet run --project src/SelfHealingSelenium/SelfHealingSelenium.csproj -- --headless
```

Run with visible browser:
```bash
dotnet run --project src/SelfHealingSelenium/SelfHealingSelenium.csproj
```

Override parameters via CLI flags:
```bash
dotnet run --project src/SelfHealingSelenium/SelfHealingSelenium.csproj -- --url="https://app.cloudqa.io/home/AutomationPracticeForm" --first-name="Abhishek" --headless
```

### Running the Test Suite

Run all unit, integration, and mutated DOM tests:
```bash
dotnet test tests/SelfHealingSelenium.Tests/SelfHealingSelenium.Tests.csproj
```

The test suite executes 11 comprehensive tests:
- `ScoringTests`: Unit tests for similarity, compatibility filters, and visibility penalties.
- `AmbiguityDetectionTests`: Verifies that duplicate textboxes trigger `AmbiguousElementMatchException`.
- `MutatedDomIntegrationTests`:
  - `WhenFieldOrderIsReordered_AllThreeFieldsAreLocatedAndVerifiedSuccessfully`: Tests DOM with State first, Gender second, First Name third.
  - `WhenIdsAndCssClassesAreChanged_SelfHealingLocatesAllThreeFields`: Tests DOM with mutated IDs (`txt_client_first_nm_991`, `rad_opt_m_882`, `sel_loc_jurisdiction_773`) and morphed CSS classes.
- `LiveCloudQaIntegrationTests`: End-to-end execution against the live CloudQA production page.

---

## 6. Sample Execution Output

```
================================================================================
                    CLOUDQA TEST EXECUTION REPORT SUMMARY                       
================================================================================
 Target URL : https://app.cloudqa.io/home/AutomationPracticeForm
 Start Time : 2026-11-06 08:06:41 UTC
 Duration   : 6.17 seconds
 Status     : PASS [ALL FIELDS VERIFIED SUCCESSFULLY]
--------------------------------------------------------------------------------
Field        | Target Value   | Verified Value   | Score    | Status
--------------------------------------------------------------------------------
FirstName    | Abhishek       | Abhishek         | 1.00     | PASS
   Matched: <input id='fname' name='First Name'> | Matched primarily via: LabelSimilarity (1.00), AccessibleName (1.00), ElementTypeCompatibility (1.00)
Gender       | Male           | Male (Selected=True) | 0.78     | PASS
   Matched: <input id='male' name='gender'> | Matched primarily via: LabelSimilarity (1.00), ElementTypeCompatibility (1.00), VisibilityAndEnabled (1.00)
State        | United States  | United States    | 0.68     | PASS
   Matched: <select id='state' name='State'> | Matched primarily via: AccessibleName (1.00), ElementTypeCompatibility (1.00), VisibilityAndEnabled (1.00)
================================================================================
```

---

## 7. Limitations & Future Improvements

1. **Custom Canvas / Non-Standard Web Components**: Form controls rendered entirely inside HTML5 `<canvas>` elements lack native DOM accessibility trees and require visual/computer-vision locators.
2. **Deep Shadow DOM Trees**: While the current engine handles slotted components and light DOM projections, interacting with closed Shadow DOM roots requires `shadowRoot.querySelector` traversal.
3. **Machine Learning Weight Tuning**: Current scoring weights (`0.30`, `0.25`, `0.20`, etc.) are empirically tuned heuristics. Future versions could train a logistic regression or decision tree model on historical locator stability data.

