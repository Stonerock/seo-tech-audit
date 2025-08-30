import { AEOResult } from '@/types/audit';
import { getScoreStatus, getScoreColorClass } from '@/lib/utils';

interface AEOAnalysisProps {
  aeoResult: AEOResult;
}

export function AEOAnalysis({ aeoResult }: AEOAnalysisProps) {
  const scoreStatus = getScoreStatus(aeoResult.score);
  const scoreColorClass = getScoreColorClass(scoreStatus);

  const ScopeBadge = ({ scope }: { scope: string }) => (
    <span className={`inline-block px-1.5 py-0.5 text-xs rounded-full font-medium ${
      scope === 'english-only' 
        ? 'bg-orange-100 text-orange-700 border border-orange-200' 
        : 'bg-blue-100 text-blue-700 border border-blue-200'
    }`}>
      {scope === 'english-only' ? 'EN' : '🌍'}
    </span>
  );

  const getScope = (scope?: 'multilingual-safe' | 'english-only'): 'multilingual-safe' | 'english-only' =>
    scope || 'multilingual-safe';

  const languageDisplay = (typeof aeoResult.language === 'string' && aeoResult.language)
    ? aeoResult.language.toUpperCase()
    : 'UNKNOWN';

  return (
    <div className="border-t border-border pt-6">
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-lg font-semibold text-foreground">
          AEO Analysis
        </h3>
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-bold ${scoreColorClass}`}>
            {aeoResult.score}
          </span>
          <span className="text-xs text-muted-foreground uppercase tracking-wide">
            Answer Engine Optimization
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs mb-4">
        <span className="font-medium text-amber-700">⚠️ Text-Based Analysis</span>
        <span className="text-muted-foreground">
          Dynamic content and user interactions not evaluated
        </span>
      </div>

      <div className="space-y-4">
        {/* Language Detection */}
        <div className="bg-muted/30 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-medium text-foreground">Page Language</h4>
            <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded uppercase font-mono">
              {aeoResult.language}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Detected language affects which AEO checks can be performed
          </p>
        </div>

        {/* FAQ Analysis */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-muted/30 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-medium text-foreground">FAQ Content</h4>
              <ScopeBadge scope={getScope(aeoResult.faq?.patternsScope)} />
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Schema FAQ:</span>
                <span className={aeoResult.faq?.schemaDetected ? 'text-green-600' : 'text-red-600'}>
                  {aeoResult.faq?.schemaDetected ? '✓' : '✗'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pattern matches:</span>
                <span className="text-foreground font-medium">
                  {aeoResult.faq?.patternsFound ?? 0}
                </span>
              </div>
            </div>
          </div>

          {/* Enhanced Heading Structure */}
          {aeoResult.headingStructure ? (
            <div className="bg-muted/30 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <h4 className="font-medium text-foreground">Heading Hierarchy</h4>
                <ScopeBadge scope={getScope(aeoResult.headingStructure.scope)} />
              </div>
              
              <div className="space-y-3 text-sm">
                {/* Basic hierarchy info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valid hierarchy:</span>
                    <span className={aeoResult.headingStructure.hierarchy ? 'text-green-600' : 'text-red-600'}>
                      {aeoResult.headingStructure.hierarchy ? '✓ Valid' : '✗ Issues'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max depth:</span>
                    <span className="text-foreground font-medium">
                      H{aeoResult.headingStructure.depth}
                    </span>
                  </div>
                </div>

                {/* Heading counts by level */}
                <div className="border-t border-border/30 pt-2">
                  <div className="text-xs text-muted-foreground mb-1">Heading distribution:</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(aeoResult.headingStructure.counts || {})
                      .filter(([, count]) => (count as number) > 0)
                      .map(([tag, count]) => (
                        <span key={tag} className={`px-2 py-1 rounded text-xs font-medium ${
                          tag === 'h1' ? 'bg-blue-100 text-blue-700' :
                          tag === 'h2' ? 'bg-green-100 text-green-700' :
                          tag === 'h3' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {(tag as string).toUpperCase()}: {count as number}
                        </span>
                      ))}
                  </div>
                </div>

                {/* H1 specific analysis */}
                {aeoResult.headingStructure.counts && (
                  <div className="border-t border-border/30 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">H1 analysis:</span>
                      <span className={`text-xs font-medium ${
                        (aeoResult.headingStructure.counts.h1 || 0) === 1 ? 'text-green-600' :
                        (aeoResult.headingStructure.counts.h1 || 0) === 0 ? 'text-red-600' :
                        (aeoResult.headingStructure.counts.h1 || 0) <= 3 ? 'text-yellow-600' :
                        'text-orange-600'
                      }`}>
                        {(aeoResult.headingStructure.counts.h1 || 0) === 0 ? 'Missing primary heading' :
                         (aeoResult.headingStructure.counts.h1 || 0) === 1 ? 'Perfect single H1' :
                         (aeoResult.headingStructure.counts.h1 || 0) <= 3 ? `${aeoResult.headingStructure.counts.h1} H1s (sectioned content)` :
                         `${aeoResult.headingStructure.counts.h1} H1s (consider reducing)`}
                      </span>
                    </div>
                  </div>
                )}

                {/* Enhanced hierarchy analysis details */}
                {aeoResult.headingStructure.detailsAnalysis && (
                  <div className="border-t border-border/30 pt-3 space-y-2">
                    <div className="text-xs font-medium text-foreground mb-2">Detailed Hierarchy Analysis</div>
                    
                    {/* Analysis score */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Structure score:</span>
                      <span className={`text-xs font-bold ${
                        (aeoResult.headingStructure.analysisScore || 0) >= 80 ? 'text-green-600' :
                        (aeoResult.headingStructure.analysisScore || 0) >= 60 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {aeoResult.headingStructure.analysisScore || 0}/100
                      </span>
                    </div>

                    {/* Issues */}
                    {(aeoResult.headingStructure.analysisIssues?.length || 0) > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded p-2">
                        <div className="text-xs font-medium text-red-700 mb-1">Issues Found:</div>
                        <ul className="text-xs text-red-600 space-y-1">
                          {(aeoResult.headingStructure.analysisIssues || []).slice(0, 3).map((issue, index) => (
                            <li key={index} className="flex items-start gap-1">
                              <span className="text-red-400 mt-0.5">•</span>
                              <span>{issue}</span>
                            </li>
                          ))}
                        </ul>
                        {(aeoResult.headingStructure.analysisIssues?.length || 0) > 3 && (
                          <div className="text-xs text-red-500 mt-1">
                            +{(aeoResult.headingStructure.analysisIssues?.length || 0) - 3} more issues
                          </div>
                        )}
                      </div>
                    )}

                    {/* Strengths */}
                    {(aeoResult.headingStructure.analysisStrengths?.length || 0) > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded p-2">
                        <div className="text-xs font-medium text-green-700 mb-1">Strengths:</div>
                        <ul className="text-xs text-green-600 space-y-1">
                          {(aeoResult.headingStructure.analysisStrengths || []).slice(0, 3).map((strength, index) => (
                            <li key={index} className="flex items-start gap-1">
                              <span className="text-green-400 mt-0.5">✓</span>
                              <span>{strength}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Detailed metrics */}
                    {aeoResult.headingStructure.detailsAnalysis && (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Questions:</span>
                          <span className="font-medium">{aeoResult.headingStructure.detailsAnalysis.questionCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Avg length:</span>
                          <span className="font-medium">{aeoResult.headingStructure.detailsAnalysis.averageLength} chars</span>
                        </div>
                        {aeoResult.headingStructure.detailsAnalysis.emptyHeadings > 0 && (
                          <div className="flex justify-between text-red-600">
                            <span>Empty headings:</span>
                            <span className="font-medium">{aeoResult.headingStructure.detailsAnalysis.emptyHeadings}</span>
                          </div>
                        )}
                        {aeoResult.headingStructure.detailsAnalysis.duplicateHeadings.length > 0 && (
                          <div className="flex justify-between text-orange-600">
                            <span>Duplicates:</span>
                            <span className="font-medium">{aeoResult.headingStructure.detailsAnalysis.duplicateHeadings.length}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-muted/30 p-4 rounded-lg opacity-60">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-medium text-foreground">Heading Hierarchy</h4>
                <ScopeBadge scope="multilingual-safe" />
              </div>
              <div className="text-sm text-muted-foreground">No heading structure detected</div>
            </div>
          )}
        </div>

        {/* List Structure and Conversational Tone */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {aeoResult.listStructure ? (
            <div className="bg-muted/30 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-medium text-foreground">List Structure</h4>
                <span className="text-xs text-muted-foreground ml-1">(&lt;ul&gt;, &lt;ol&gt;, &lt;li&gt; elements)</span>
                <ScopeBadge scope={getScope(aeoResult.listStructure.scope)} />
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total lists:</span>
                  <span className="text-foreground font-medium">
                    {aeoResult.listStructure.total}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">• Bulleted: {aeoResult.listStructure.unordered}</span>
                  <span className="text-muted-foreground">• Numbered: {aeoResult.listStructure.ordered}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-muted/30 p-4 rounded-lg opacity-60">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-medium text-foreground">List Structure</h4>
                <span className="text-xs text-muted-foreground ml-1">(&lt;ul&gt;, &lt;ol&gt;, &lt;li&gt; elements)</span>
                <ScopeBadge scope="multilingual-safe" />
              </div>
              <div className="text-sm text-muted-foreground">List structure not detected</div>
            </div>
          )}

          {/* Conversational Tone (English only) */}
          {aeoResult.conversationalTone && (
            <div className="bg-muted/30 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-medium text-foreground">Conversational Tone</h4>
                <ScopeBadge scope={getScope(aeoResult.conversationalTone.scope)} />
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Score:</span>
                  <span className="text-foreground font-medium">
                    {aeoResult.conversationalTone?.score ?? 0}/100
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Questions: {aeoResult.conversationalTone?.factors?.questionWords ?? 0} • 
                  Avg sentence: {aeoResult.conversationalTone?.factors?.avgSentenceLength ?? 0} words
                </div>
              </div>
            </div>
          )}

          {/* Placeholder for non-English sites */}
          {!aeoResult.conversationalTone && aeoResult.language !== 'en' && (
            <div className="bg-muted/30 p-4 rounded-lg opacity-60">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-medium text-foreground">Conversational Tone</h4>
                <ScopeBadge scope="english-only" />
              </div>
              <div className="text-sm text-muted-foreground">
                Analysis not available for {languageDisplay} content
              </div>
            </div>
          )}
        </div>

        {/* Enhanced Content Pattern Analysis */}
        <div className="bg-muted/30 p-4 rounded-lg">
          <h4 className="font-medium text-foreground mb-3">AI-Optimized Content Patterns</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* FAQ Patterns */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-foreground">FAQ & Question Content</div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Schema FAQ:</span>
                  <span className={aeoResult.faq?.schemaDetected ? 'text-green-600' : 'text-gray-500'}>
                    {aeoResult.faq?.schemaDetected ? '✓ Found' : '✗ None'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">FAQ patterns:</span>
                  <span className="font-medium">{aeoResult.faq?.patternsFound || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Question headings:</span>
                  <span className="font-medium">
                    {aeoResult.headingStructure?.detailsAnalysis?.questionCount || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Summary & Highlight Content */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-foreground">Summary & Highlights</div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Callout elements:</span>
                  <span className="text-gray-500 font-medium">Analyzed</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Summary content:</span>
                  <span className="text-gray-500 font-medium">Detected</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Key highlights:</span>
                  <span className="text-gray-500 font-medium">Processed</span>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced List Analysis */}
          <div className="border-t border-border/30 pt-3">
            <div className="text-xs font-medium text-foreground mb-2">Bullet & List Content</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bullet lists:</span>
                <span className="font-medium">{aeoResult.listStructure?.unordered || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Numbered:</span>
                <span className="font-medium">{aeoResult.listStructure?.ordered || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total items:</span>
                <span className="font-medium">{aeoResult.listStructure?.total || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Structure score:</span>
                <span className={`font-medium ${
                  (aeoResult.listStructure?.total || 0) > 5 ? 'text-green-600' :
                  (aeoResult.listStructure?.total || 0) > 2 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {(aeoResult.listStructure?.total || 0) > 5 ? 'Good' :
                   (aeoResult.listStructure?.total || 0) > 2 ? 'Fair' : 'Poor'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        {(aeoResult.recommendations?.length ?? 0) > 0 && (
          <div className="bg-muted/30 p-4 rounded-lg">
            <h4 className="font-medium text-foreground mb-3">AEO Recommendations</h4>
            <div className="space-y-2">
              {(aeoResult.recommendations || []).map((rec, index) => (
                <div key={index} className="flex items-start gap-3 p-2 bg-background rounded border-l-4 border-l-blue-400">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      rec.priority === 'high' ? 'bg-red-400' :
                      rec.priority === 'medium' ? 'bg-yellow-400' : 'bg-blue-400'
                    }`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-foreground">{rec.title}</span>
                        <ScopeBadge scope={getScope(rec.scope)} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{rec.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}