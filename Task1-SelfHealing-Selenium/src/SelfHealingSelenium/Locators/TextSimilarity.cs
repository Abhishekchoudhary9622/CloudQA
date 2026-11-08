using System.Text.RegularExpressions;

namespace SelfHealingSelenium.Locators;

public static class TextSimilarity
{
    private static readonly Regex TokenSplitter = new(@"[\s_\-\.:;,/]+", RegexOptions.Compiled);

    public static double ComputeBestSimilarity(string? candidateText, string targetText, IEnumerable<string>? aliases = null)
    {
        if (string.IsNullOrWhiteSpace(candidateText) || string.IsNullOrWhiteSpace(targetText))
            return 0.0;

        var cleanCandidate = Normalize(candidateText);
        var cleanTarget = Normalize(targetText);

        if (cleanCandidate == cleanTarget)
            return 1.0;

        var scores = new List<double>
        {
            CalculatePairSimilarity(cleanCandidate, cleanTarget)
        };

        if (aliases != null)
        {
            foreach (var alias in aliases)
            {
                var cleanAlias = Normalize(alias);
                scores.Add(CalculatePairSimilarity(cleanCandidate, cleanAlias));
            }
        }

        return scores.Max();
    }

    private static double CalculatePairSimilarity(string a, string b)
    {
        if (a == b) return 1.0;
        if (a.Length == 0 || b.Length == 0) return 0.0;

        // Antonym / opposite distinction (crucial for radio/choice fields like male/female)
        if ((a == "male" && b.StartsWith("female")) || (b == "male" && a.StartsWith("female")) ||
            (a == "female" && b == "male") || (b == "female" && a == "male"))
        {
            return 0.0;
        }

        // Multi-word phrase containment (e.g. "first" in "first name" or "name" in "first name")
        var isMultiWord = a.Contains(' ') || b.Contains(' ');
        if (isMultiWord)
        {
            var tokensA = TokenSplitter.Split(a).Where(t => t.Length > 0).ToHashSet();
            var tokensB = TokenSplitter.Split(b).Where(t => t.Length > 0).ToHashSet();
            if (tokensA.Count > 0 && tokensB.Count > 0 &&
                (tokensA.IsSubsetOf(tokensB) || tokensB.IsSubsetOf(tokensA)))
            {
                var ratio = (double)Math.Min(tokensA.Count, tokensB.Count) / Math.Max(tokensA.Count, tokensB.Count);
                return Math.Max(0.85, 0.70 + 0.30 * ratio);
            }
        }

        // Acronym match check (e.g., fname for first name)
        if (IsAcronymMatch(a, b) || IsAcronymMatch(b, a))
        {
            return 0.90;
        }

        // Token Jaccard similarity
        var jaccard = TokenJaccardSimilarity(a, b);

        // Damerau-Levenshtein edit distance similarity
        var damerauLev = DamerauLevenshteinSimilarity(a, b);

        return Math.Max(damerauLev, jaccard);
    }

    private static bool IsAcronymMatch(string shortStr, string longStr)
    {
        if (shortStr.Length < 2 || shortStr.Length > 8) return false;
        var words = TokenSplitter.Split(longStr).Where(w => w.Length > 0).ToArray();
        if (words.Length < 2) return false;

        var initials = new string(words.Select(w => w[0]).ToArray());
        return shortStr.Equals(initials, StringComparison.OrdinalIgnoreCase);
    }

    public static double TokenJaccardSimilarity(string a, string b)
    {
        var tokensA = new HashSet<string>(TokenSplitter.Split(a).Where(t => t.Length > 0));
        var tokensB = new HashSet<string>(TokenSplitter.Split(b).Where(t => t.Length > 0));

        if (tokensA.Count == 0 || tokensB.Count == 0) return 0.0;

        var intersectionCount = tokensA.Intersect(tokensB).Count();
        var unionCount = tokensA.Union(tokensB).Count();

        return (double)intersectionCount / unionCount;
    }

    public static double DamerauLevenshteinSimilarity(string s1, string s2)
    {
        var dist = DamerauLevenshteinDistance(s1, s2);
        var maxLen = Math.Max(s1.Length, s2.Length);
        if (maxLen == 0) return 1.0;
        return 1.0 - ((double)dist / maxLen);
    }

    public static int DamerauLevenshteinDistance(string s1, string s2)
    {
        int len1 = s1.Length;
        int len2 = s2.Length;
        var d = new int[len1 + 1, len2 + 1];

        for (int i = 0; i <= len1; i++) d[i, 0] = i;
        for (int j = 0; j <= len2; j++) d[0, j] = j;

        for (int i = 1; i <= len1; i++)
        {
            for (int j = 1; j <= len2; j++)
            {
                int cost = (s1[i - 1] == s2[j - 1]) ? 0 : 1;
                d[i, j] = Math.Min(
                    Math.Min(d[i - 1, j] + 1, d[i, j - 1] + 1),
                    d[i - 1, j - 1] + cost
                );

                if (i > 1 && j > 1 && s1[i - 1] == s2[j - 2] && s1[i - 2] == s2[j - 1])
                {
                    d[i, j] = Math.Min(d[i, j], d[i - 2, j - 2] + cost);
                }
            }
        }

        return d[len1, len2];
    }

    public static string Normalize(string input)
    {
        if (string.IsNullOrWhiteSpace(input)) return string.Empty;
        var lower = input.ToLowerInvariant();
        return Regex.Replace(lower, @"[^a-z0-9\s]", " ").Trim();
    }
}
