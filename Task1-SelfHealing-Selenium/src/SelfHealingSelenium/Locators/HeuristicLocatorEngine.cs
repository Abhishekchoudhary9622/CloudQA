using Microsoft.Extensions.Logging;
using OpenQA.Selenium;
using SelfHealingSelenium.Configuration;
using SelfHealingSelenium.Locators.Exceptions;
using SelfHealingSelenium.Locators.Scorers;
using SelfHealingSelenium.Models;

namespace SelfHealingSelenium.Locators;

public class HeuristicLocatorEngine
{
    private readonly IWebDriver _driver;
    private readonly AutomationOptions _options;
    private readonly ILogger _logger;
    private readonly List<IElementScorer> _scorers;

    public HeuristicLocatorEngine(IWebDriver driver, AutomationOptions options, ILogger logger)
    {
        _driver = driver;
        _options = options;
        _logger = logger;

        _scorers = new List<IElementScorer>
        {
            new LabelSimilarityScorer(),
            new AccessibleNameScorer(),
            new ElementTypeCompatibilityScorer(),
            new VisibilityEnabledScorer(),
            new SemanticContextScorer(),
            new NearbyLabelScorer()
        };
    }

    /// <summary>
    /// Intelligently discovers the best matching element for a target field specification.
    /// </summary>
    public (IWebElement Element, HealingDiagnostic Diagnostic) Locate(FieldTargetSpec target)
    {
        _logger.LogInformation("Beginning heuristic element discovery for field '{FieldKey}' (ExpectedType={Type}, Label='{Label}')",
            target.FieldKey, target.ExpectedType, target.TargetLabel);

        var rawElements = QueryPotentialCandidateElements(target.ExpectedType);
        _logger.LogDebug("Discovered {Count} initial candidate elements in DOM", rawElements.Count);

        var candidates = new List<ElementCandidate>();
        var js = (IJavaScriptExecutor)_driver;

        foreach (var el in rawElements)
        {
            try
            {
                var candidate = ExtractCandidateAttributes(el, js);
                ScoreCandidate(candidate, target);
                candidates.Add(candidate);
            }
            catch (StaleElementReferenceException)
            {
                // DOM changed during extraction, skip stale candidate
            }
            catch (Exception ex)
            {
                _logger.LogTrace("Error extracting candidate attributes: {Message}", ex.Message);
            }
        }

        // Filter and sort descending by score
        var ranked = candidates
            .Where(c => c.TotalConfidenceScore > 0.0)
            .OrderByDescending(c => c.TotalConfidenceScore)
            .ToList();

        _logger.LogInformation("Evaluated {Count} viable candidates for '{FieldKey}'", ranked.Count, target.FieldKey);
        foreach (var c in ranked.Take(3))
        {
            _logger.LogDebug("  Candidate: {Candidate} | TotalScore={Score:F3}", c, c.TotalConfidenceScore);
        }

        // 1. Check for Ambiguity
        if (ranked.Count >= 2)
        {
            var first = ranked[0];
            var second = ranked[1];

            if (first.TotalConfidenceScore >= _options.MinConfidenceThreshold &&
                second.TotalConfidenceScore >= _options.MinConfidenceThreshold)
            {
                var diff = first.TotalConfidenceScore - second.TotalConfidenceScore;
                if (diff < _options.AmbiguityMarginThreshold)
                {
                    _logger.LogError("Ambiguity detected for '{FieldKey}': Candidate 1 (Score: {S1:F3}) vs Candidate 2 (Score: {S2:F3}), difference {Diff:F3} < margin {Margin:F3}",
                        target.FieldKey, first.TotalConfidenceScore, second.TotalConfidenceScore, diff, _options.AmbiguityMarginThreshold);

                    throw new AmbiguousElementMatchException(
                        target.FieldKey, first, second, diff, _options.AmbiguityMarginThreshold);
                }
            }
        }

        // 2. Check threshold
        if (ranked.Count == 0 || ranked[0].TotalConfidenceScore < _options.MinConfidenceThreshold)
        {
            var bestScore = ranked.Count > 0 ? ranked[0].TotalConfidenceScore : 0.0;
            _logger.LogWarning("Highest candidate score ({Best:F3}) for '{FieldKey}' is below minimum threshold ({Min:F3})",
                bestScore, target.FieldKey, _options.MinConfidenceThreshold);

            // Attempt explicit fallback if configured
            if (target.ExplicitFallbackSelector != null)
            {
                _logger.LogInformation("Attempting explicit fallback locator '{Selector}' for field '{FieldKey}'",
                    target.ExplicitFallbackSelector, target.FieldKey);
                try
                {
                    var fallbackEl = _driver.FindElement(target.ExplicitFallbackSelector);
                    if (fallbackEl != null && fallbackEl.Displayed)
                    {
                        var diagFallback = new HealingDiagnostic
                        {
                            FieldKey = target.FieldKey,
                            TargetLabel = target.TargetLabel,
                            HealedSuccessfully = true,
                            UsedExplicitFallback = true,
                            WinningScore = bestScore,
                            WinningElementDescription = $"Fallback: {target.ExplicitFallbackSelector}",
                            StrategySummary = "Recovered via explicit fallback selector after heuristic scoring fell below threshold."
                        };
                        return (fallbackEl, diagFallback);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError("Explicit fallback selector failed: {Message}", ex.Message);
                }
            }

            throw new ElementNotFoundException(target.FieldKey, bestScore, _options.MinConfidenceThreshold, ranked);
        }

        var winner = ranked[0];
        _logger.LogInformation("Selected candidate '{Winner}' with confidence score {Score:F3}", winner, winner.TotalConfidenceScore);

        var diagnostic = new HealingDiagnostic
        {
            FieldKey = target.FieldKey,
            TargetLabel = target.TargetLabel,
            HealedSuccessfully = true,
            UsedExplicitFallback = false,
            WinningScore = winner.TotalConfidenceScore,
            WinningElementDescription = $"<{winner.TagName} id='{winner.Id}' name='{winner.Name}'>",
            StrategySummary = BuildStrategySummary(winner),
            TopCandidates = ranked.Take(3).Select(c => new CandidateScoreInfo
            {
                ElementIdentifier = $"<{c.TagName} id='{c.Id}' name='{c.Name}'>",
                TotalScore = c.TotalConfidenceScore,
                Breakdown = new Dictionary<string, double>(c.ComponentScores)
            }).ToList()
        };

        return (winner.WebElement, diagnostic);
    }

    private string BuildStrategySummary(ElementCandidate winner)
    {
        var topComponents = winner.ComponentScores
            .OrderByDescending(kv => kv.Value)
            .Take(3)
            .Select(kv => $"{kv.Key} ({kv.Value:F2})");
        return $"Matched primarily via: {string.Join(", ", topComponents)}";
    }

    private void ScoreCandidate(ElementCandidate candidate, FieldTargetSpec target)
    {
        var weights = _options.ScoringWeights;
        double totalWeighted = 0.0;
        double totalWeightSum = 0.0;

        foreach (var scorer in _scorers)
        {
            var raw = scorer.CalculateScore(candidate, target, _options);
            candidate.ComponentScores[scorer.Name] = raw;

            var weight = scorer.Name switch
            {
                "LabelSimilarity" => weights.LabelSimilarity,
                "AccessibleName" => weights.AccessibleName,
                "ElementTypeCompatibility" => weights.ElementTypeCompatibility,
                "SemanticContext" => weights.SemanticContext,
                "NearbyLabel" => weights.NearbyLabel,
                "VisibilityAndEnabled" => weights.VisibilityAndEnabled,
                _ => 0.1
            };

            totalWeighted += raw * weight;
            totalWeightSum += weight;
        }

        // Hard requirement 1: If ElementTypeCompatibility is 0, total score is 0
        if (candidate.ComponentScores.TryGetValue("ElementTypeCompatibility", out var compat) && compat <= 0.0)
        {
            candidate.TotalConfidenceScore = 0.0;
            return;
        }

        // Hard requirement 2: Element must be visible and enabled to be an interactable candidate
        if (!candidate.IsDisplayed || !candidate.IsEnabled)
        {
            candidate.TotalConfidenceScore = 0.0;
            return;
        }

        // Hard requirement 3: If SubTargetValue is specified for a radio button (e.g. "Male"),
        // candidate MUST match the subtarget option value/label/id.
        if (target.ExpectedType == ElementType.RadioButton && !string.IsNullOrWhiteSpace(target.SubTargetValue))
        {
            double optionScore = 0.0;
            if (!string.IsNullOrWhiteSpace(candidate.Value))
                optionScore = TextSimilarity.ComputeBestSimilarity(candidate.Value, target.SubTargetValue);
            else if (!string.IsNullOrWhiteSpace(candidate.AssociatedLabelText))
                optionScore = TextSimilarity.ComputeBestSimilarity(candidate.AssociatedLabelText, target.SubTargetValue);
            else if (!string.IsNullOrWhiteSpace(candidate.Id))
                optionScore = TextSimilarity.ComputeBestSimilarity(candidate.Id, target.SubTargetValue) * 0.90;
            else if (!string.IsNullOrWhiteSpace(candidate.NearbyText))
                optionScore = TextSimilarity.ComputeBestSimilarity(candidate.NearbyText, target.SubTargetValue);

            if (optionScore < 0.50)
            {
                // Mismatching radio option (e.g. Female or Transgender when searching for Male)
                candidate.TotalConfidenceScore = 0.0;
                return;
            }
        }

        var baseScore = totalWeightSum > 0 ? (totalWeighted / totalWeightSum) : 0.0;
        // Slotted demo template penalty
        if (candidate.IsSlotted)
        {
            baseScore -= 0.20;
        }

        candidate.TotalConfidenceScore = Math.Max(0.0, baseScore);
    }

    private ElementCandidate ExtractCandidateAttributes(IWebElement el, IJavaScriptExecutor js)
    {
        var tag = el.TagName.ToLowerInvariant();
        var type = (el.GetAttribute("type") ?? string.Empty).ToLowerInvariant();
        var id = el.GetAttribute("id") ?? string.Empty;
        var name = el.GetAttribute("name") ?? string.Empty;
        var placeholder = el.GetAttribute("placeholder") ?? string.Empty;
        var ariaLabel = el.GetAttribute("aria-label") ?? string.Empty;
        var ariaLabelledBy = el.GetAttribute("aria-labelledby") ?? string.Empty;
        var ariaRole = el.GetAttribute("role") ?? string.Empty;
        var value = el.GetAttribute("value") ?? string.Empty;
        var text = el.Text ?? string.Empty;
        var isDisplayed = el.Displayed;
        var isEnabled = el.Enabled;

        // Resolve aria-labelledby text if present
        var ariaLabelledByText = string.Empty;
        if (!string.IsNullOrWhiteSpace(ariaLabelledBy))
        {
            try
            {
                var refEl = _driver.FindElements(By.Id(ariaLabelledBy)).FirstOrDefault();
                if (refEl != null) ariaLabelledByText = refEl.Text;
            }
            catch { }
        }

        // Extract associated label text and nearby text using lightweight JS in page context
        var associatedLabel = string.Empty;
        var parentContainerText = string.Empty;
        var nearbyText = string.Empty;
        var isSlotted = false;

        try
        {
            var script = @"
                var el = arguments[0];
                var res = { labelText: '', containerText: '', nearbyText: '', isSlotted: false };
                
                // 1. Label with for=id or for=name
                if (el.id) {
                    var l = document.querySelector('label[for=""' + el.id + '""]') || 
                            document.querySelector('span[for=""' + el.id + '""]');
                    if (l) res.labelText = l.innerText || l.textContent || '';
                }
                if (!res.labelText && el.name) {
                    var l2 = document.querySelector('label[for=""' + el.name + '""]') ||
                             document.querySelector('label[name=""' + el.name + '""]') ||
                             document.querySelector('span[name=""' + el.name + '""]');
                    if (l2) res.labelText = l2.innerText || l2.textContent || '';
                }

                // 2. Ancestor label or wrapping label
                if (!res.labelText) {
                    var parentLabel = el.closest('label');
                    if (parentLabel) res.labelText = parentLabel.innerText || parentLabel.textContent || '';
                }

                // 3. Parent container text (form-group, fieldset, section-region, row-wrapper, well)
                var container = el.closest('.form-group, fieldset, .section-region, .row-wrapper, .custom-card, [role=""group""], .well');
                if (!container) {
                    container = el.closest('form, section');
                }
                if (container) {
                    var legend = container.querySelector('legend');
                    var legendText = legend ? (legend.innerText || legend.textContent || '') + ' ' : '';
                    res.containerText = (legendText + (container.innerText || container.textContent || '')).slice(0, 400);
                }

                // 4. Slotted check: If inside a [slot] section or shadow-form demo template, mark it
                res.isSlotted = !!el.closest('[slot], shadow-form, template');

                // 5. Nearby sibling text (including text nodes and element siblings)
                var nearby = '';
                var prev = el.previousSibling;
                var next = el.nextSibling;
                if (prev) nearby += ' ' + (prev.textContent || '');
                if (next) nearby += ' ' + (next.textContent || '');
                if (el.previousElementSibling) nearby += ' ' + (el.previousElementSibling.innerText || el.previousElementSibling.textContent || '');
                if (el.nextElementSibling) nearby += ' ' + (el.nextElementSibling.innerText || el.nextElementSibling.textContent || '');
                res.nearbyText = nearby.trim().slice(0, 300);

                return res;
            ";

            var data = js.ExecuteScript(script, el) as Dictionary<string, object>;
            if (data != null)
            {
                if (data.TryGetValue("labelText", out var l) && l != null) associatedLabel = l.ToString() ?? "";
                if (data.TryGetValue("containerText", out var c) && c != null) parentContainerText = c.ToString() ?? "";
                if (data.TryGetValue("nearbyText", out var n) && n != null) nearbyText = n.ToString() ?? "";
                if (data.TryGetValue("isSlotted", out var s) && s is bool sb) isSlotted = sb;
            }
        }
        catch { }

        return new ElementCandidate
        {
            WebElement = el,
            TagName = tag,
            Type = type,
            Id = id,
            Name = name,
            Placeholder = placeholder,
            AriaLabel = ariaLabel,
            AriaLabelledBy = !string.IsNullOrWhiteSpace(ariaLabelledByText) ? ariaLabelledByText : ariaLabelledBy,
            AriaRole = ariaRole,
            Value = value,
            VisibleText = text,
            AssociatedLabelText = associatedLabel,
            ParentContainerText = parentContainerText,
            NearbyText = nearbyText,
            IsDisplayed = isDisplayed,
            IsEnabled = isEnabled,
            IsSlotted = isSlotted
        };
    }

    private List<IWebElement> QueryPotentialCandidateElements(ElementType expectedType)
    {
        return expectedType switch
        {
            ElementType.TextInput => _driver.FindElements(By.CssSelector("input:not([type='hidden']):not([type='radio']):not([type='checkbox']):not([type='submit']):not([type='button']), textarea, [role='textbox']")).ToList(),
            ElementType.RadioButton => _driver.FindElements(By.CssSelector("input[type='radio'], [role='radio']")).ToList(),
            ElementType.SelectDropdown => _driver.FindElements(By.CssSelector("select, [role='combobox'], [role='listbox']")).ToList(),
            ElementType.Button => _driver.FindElements(By.CssSelector("button, input[type='button'], input[type='submit'], [role='button']")).ToList(),
            _ => _driver.FindElements(By.CssSelector("input, select, textarea, button")).ToList()
        };
    }
}
