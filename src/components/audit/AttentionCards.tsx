import { TrendingUp, Zap, Eye, Brain, BookOpen, Users, Info, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { calculateNewCategoryScores, getScoreStatus } from '@/lib/utils';
import { useState } from 'react';
import type { AuditResult } from '@/types/audit';

interface AttentionCardsProps {
  results: AuditResult;
}

export function AttentionCards({ results }: AttentionCardsProps) {
  const [showInfoModal, setShowInfoModal] = useState(false);
  const scores = calculateNewCategoryScores(results);

  const cards = [
    {
      title: 'Machine Comprehension',
      subtitle: '(30%)',
      score: scores.machineComprehension,
      icon: Brain,
      description: 'Can AI actually understand your site? — we check schema, entities, headings, and alt text.',
      gradient: 'from-blue-500/10 to-blue-600/10',
      borderColor: 'border-blue-500/20',
      priority: 'Strategic',
    },
    {
      title: 'Content Structure & Answerability',
      subtitle: '(25%)',
      score: scores.contentStructure,
      icon: BookOpen,
      description: 'Is your content chunkable and answer-ready? — we measure section sizes, Q&A headings, and lists.',
      gradient: 'from-emerald-500/10 to-emerald-600/10',
      borderColor: 'border-emerald-500/20',
      priority: 'Quick Win',
    },
    {
      title: 'Technical Quality',
      subtitle: '(25%)',
      score: scores.technicalQuality,
      icon: Zap,
      description: 'Fast, crawlable, visible — Core Web Vitals, robots/sitemap, and content without JS walls.',
      gradient: 'from-orange-500/10 to-orange-600/10',
      borderColor: 'border-orange-500/20',
      priority: 'Quick Win',
    },
    {
      title: 'Accessibility & Inclusivity',
      subtitle: '(7%)',
      score: scores.accessibility,
      icon: Eye,
      description: 'Alt text, contrast, and landmarks — signals that help both humans and machines read your site.',
      gradient: 'from-purple-500/10 to-purple-600/10',
      borderColor: 'border-purple-500/20',
      priority: 'Quick Win',
    },
    {
      title: 'Trust, Transparency & Governance',
      subtitle: '(13%)',
      score: scores.trustGovernance,
      icon: Users,
      description: 'Who\'s behind the content? — author bios, publisher details, corroboration, and llms.txt governance.',
      gradient: 'from-indigo-500/10 to-indigo-600/10',
      borderColor: 'border-indigo-500/20',
      priority: 'Strategic',
    },
  ];

  const InfoModal = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-background rounded-lg max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">ℹ️ How we evaluate your site</h2>
            <Button variant="ghost" size="sm" onClick={() => setShowInfoModal(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="space-y-6 text-sm">
            <div>
              <p className="text-muted-foreground mb-4">
                <strong>Attention may be all you need in AI…</strong><br/>
                but for websites, AI engines also need structure, speed, and trust.
              </p>
              <p className="text-muted-foreground">
                Our audit looks at five big levers that make your site easier for AI systems (Google AI Overviews, ChatGPT, Gemini, Bing Copilot, etc.) to understand, chunk, and cite.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">🔎 What we measure</h3>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-blue-600">🧠 Machine Comprehension (30%)</h4>
                  <p className="text-muted-foreground mt-1">Can machines actually understand your site? We check schema markup (Organization, Product, FAQ), entity links (LinkedIn, Wikidata, Crunchbase), semantic HTML, and alt text.</p>
                </div>
                
                <div>
                  <h4 className="font-medium text-emerald-600">📚 Content Structure & Answerability (25%)</h4>
                  <p className="text-muted-foreground mt-1">Can your content be snapped into answers? We measure section sizes, paragraph readability, Q&A-style headings, lists/tables, and deep-link anchors.</p>
                </div>
                
                <div>
                  <h4 className="font-medium text-orange-600">⚡ Technical Quality (25%)</h4>
                  <p className="text-muted-foreground mt-1">Does your site load fast and render clearly? We look at Core Web Vitals (LCP, INP, CLS), crawlability (robots.txt + sitemap), and whether key content shows up without JavaScript.</p>
                </div>
                
                <div>
                  <h4 className="font-medium text-purple-600">♿ Accessibility & Inclusivity (7%)</h4>
                  <p className="text-muted-foreground mt-1">Alt text, color contrast, ARIA landmarks — signals that help both humans and machines parse your content.</p>
                </div>
                
                <div>
                  <h4 className="font-medium text-indigo-600">🤝 Trust, Transparency & Governance (13%)</h4>
                  <p className="text-muted-foreground mt-1">Who's behind your content? We check for author bios, publisher details, external corroboration, and whether you declare AI access in llms.txt.</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">⚖️ How the score works</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>• Each category has a fixed weight (in % above).</li>
                <li>• Each metric is scored from evidence (e.g. tokens per section, % of images with alt text).</li>
                <li>• The overall score (0–100) is a weighted mean of all categories.</li>
                <li>• If parts of the site are JS-locked or time out, we show partial results instead of guessing.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">🤖 Why it matters</h3>
              <p className="text-muted-foreground mb-2">
                AI assistants don't just "read" — they chunk, extract, and cross-check.
              </p>
              <p className="text-muted-foreground">
                The closer your site is to being machine-friendly, the more likely it is to show up as the cited source in AI-generated answers.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">📚 Learn more (external references)</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>• Google Search Central — AI Overviews: How it works</li>
                <li>• Google Developers — Core Web Vitals</li>
                <li>• W3C — Web Content Accessibility Guidelines (WCAG) 2.1</li>
                <li>• Schema.org — Structured Data reference</li>
                <li>• OpenAI — Crawling and llms.txt</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Overall Score Header */}
      <Card className="border-primary/30 shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-primary" />
              <div>
                <CardTitle className="text-xl font-serif">AI Comprehension Analysis</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  How well AI systems can understand and interpret your website's content and purpose
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowInfoModal(true)}
              className="gap-2"
            >
              <Info className="w-4 h-4" />
              How it works
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-6">
            <div className="space-y-2">
              <div className="score-display">{scores.overall}</div>
              <div className="text-sm font-medium text-muted-foreground">
                AI Readiness Score
              </div>
            </div>
            <div className="text-right space-y-1">
              <div className={`text-sm font-medium px-3 py-1 rounded-full border ${
                getScoreStatus(scores.overall) === 'excellent' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                getScoreStatus(scores.overall) === 'good' ? 'bg-green-50 text-green-700 border-green-200' :
                getScoreStatus(scores.overall) === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                'bg-red-50 text-red-700 border-red-200'
              }`}>
                {getScoreStatus(scores.overall).toUpperCase()}
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                {results.executionTime}ms analysis
              </div>
            </div>
          </div>
          <Progress 
            value={scores.overall} 
            status={getScoreStatus(scores.overall)} 
            className="h-2 mb-4"
          />
          <div className="paper-meta">
            <p className="text-sm italic text-muted-foreground">
              Attention may be all you need in AI, but websites need structure, speed, and trust.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 5 Category Cards with Priority Grouping */}
      <div className="space-y-6">
        {/* Quick Wins Section */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-lg font-semibold text-foreground">⚡ Quick Wins</h3>
            <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">Lower effort, immediate impact</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {cards.filter(card => card.priority === 'Quick Win').map((card) => (
              <CategoryCard key={card.title} card={card} />
            ))}
          </div>
        </div>

        {/* Strategic Section */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-lg font-semibold text-foreground">🎯 Strategic</h3>
            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">Higher effort, long-term value</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cards.filter(card => card.priority === 'Strategic').map((card) => (
              <CategoryCard key={card.title} card={card} />
            ))}
          </div>
        </div>
      </div>

      {/* Info Modal */}
      {showInfoModal && <InfoModal />}

    </div>
  );
}

// CategoryCard component
function CategoryCard({ card }: { card: any }) {
  const Icon = card.icon;
  const status = getScoreStatus(card.score);
  
  return (
    <Card className="metric-card hover:shadow-lg transition-all duration-200 h-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5" />
            <div>
              <CardTitle className="text-base leading-tight">{card.title}</CardTitle>
              <span className="text-xs text-muted-foreground font-mono">{card.subtitle}</span>
            </div>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full ${
            card.priority === 'Quick Win' 
              ? 'bg-green-100 text-green-700' 
              : 'bg-blue-100 text-blue-700'
          }`}>
            {card.priority}
          </span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {card.description}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-foreground">{card.score}</div>
            <div className={`text-sm font-medium px-3 py-1 rounded-full ${
              status === 'excellent' ? 'bg-emerald-500/20 text-emerald-400' :
              status === 'good' ? 'bg-green-500/20 text-green-400' :
              status === 'warning' ? 'bg-amber-500/20 text-amber-400' :
              'bg-red-500/20 text-red-400'
            }`}>
              {status}
            </div>
          </div>
          <Progress value={card.score} status={status} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}