using SelfHealingSelenium.Configuration;
using SelfHealingSelenium.Models;

namespace SelfHealingSelenium.Locators.Scorers;

public class ElementTypeCompatibilityScorer : IElementScorer
{
    public string Name => "ElementTypeCompatibility";

    public double CalculateScore(ElementCandidate candidate, FieldTargetSpec target, AutomationOptions options)
    {
        var tag = candidate.TagName.ToLowerInvariant();
        var type = candidate.Type.ToLowerInvariant();
        var role = candidate.AriaRole.ToLowerInvariant();

        switch (target.ExpectedType)
        {
            case ElementType.TextInput:
                if (tag == "textarea") return 1.0;
                if (tag == "input")
                {
                    if (string.IsNullOrEmpty(type) || type == "text" || type == "search" || type == "tel" || type == "email" || type == "url")
                        return 1.0;
                    if (type == "password")
                        return 0.7; // possible fallback if input morphed
                    // Disqualify explicitly incompatible types
                    if (type is "radio" or "checkbox" or "button" or "submit" or "reset" or "file" or "hidden")
                        return 0.0;
                }
                if (role == "textbox") return 1.0;
                return 0.0;

            case ElementType.RadioButton:
                if (tag == "input" && type == "radio") return 1.0;
                if (role == "radio") return 1.0;
                return 0.0;

            case ElementType.SelectDropdown:
                if (tag == "select") return 1.0;
                if (role is "combobox" or "listbox") return 1.0;
                return 0.0;

            case ElementType.Button:
                if (tag == "button") return 1.0;
                if (tag == "input" && type is "button" or "submit") return 1.0;
                if (role == "button") return 1.0;
                return 0.0;

            default:
                return 0.5;
        }
    }
}

