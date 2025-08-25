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

          {/* Heading Structure */}
          {aeoResult.headingStructure ? (
            <div className="bg-muted/30 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-medium text-foreground">Content Structure</h4>
                <ScopeBadge scope={getScope(aeoResult.headingStructure.scope)} />
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Hierarchy:</span>
                  <span className={aeoResult.headingStructure.hierarchy ? 'text-green-600' : 'text-red-600'}>
                    {aeoResult.headingStructure.hierarchy ? '✓' : '✗'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Depth:</span>
                  <span className="text-foreground font-medium">
                    H1-H{aeoResult.headingStructure.depth}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {Object.entries(aeoResult.headingStructure.counts || {})
                    .filter(([, count]) => (count as number) > 0)
                    .map(([tag, count]) => `${(tag as string).toUpperCase()}: ${count as number}`)
                    .join(', ')}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-muted/30 p-4 rounded-lg opacity-60">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-medium text-foreground">Content Structure</h4>
                <ScopeBadge scope="multilingual-safe" />
              </div>
              <div className="text-sm text-muted-foreground">Structure not detected</div>
            </div>
          )}
        </div>

        {/* List Structure and Conversational Tone */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {aeoResult.listStructure ? (
            <div className="bg-muted/30 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-medium text-foreground">List Structure</h4>
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
                Analysis not available for {aeoResult.language.toUpperCase()} content
              </div>
            </div>
          )}
        </div>

        {/* Recommendations */}
        {aeoResult.recommendations.length > 0 && (
          <div className="bg-muted/30 p-4 rounded-lg">
            <h4 className="font-medium text-foreground mb-3">AEO Recommendations</h4>
            <div className="space-y-2">
              {aeoResult.recommendations.map((rec, index) => (
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