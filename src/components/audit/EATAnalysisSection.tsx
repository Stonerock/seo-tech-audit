import { Shield, User, Award, CheckCircle, AlertTriangle, ExternalLink, BookOpen, Building } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { getScoreStatus } from '@/lib/utils';
import type { EATResult } from '@/types/audit';

interface EATAnalysisSectionProps {
  eatResult: EATResult;
}

export function EATAnalysisSection({ eatResult }: EATAnalysisSectionProps) {
  // Safety checks for undefined properties
  if (!eatResult || typeof eatResult.overallScore === 'undefined') {
    return (
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <Shield className="w-8 h-8 mx-auto mb-2" />
            <p>E-A-T analysis data not available</p>
            <p className="text-xs mt-1">Analysis may have failed or timed out</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const overallStatus = getScoreStatus(eatResult.overallScore || 0);
  const expertiseStatus = getScoreStatus(eatResult.expertise?.score || 0);
  const authorityStatus = getScoreStatus(eatResult.authoritativeness?.score || 0);
  const trustStatus = getScoreStatus(eatResult.trustworthiness?.score || 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'text-emerald-700 bg-emerald-100';
      case 'good': return 'text-green-700 bg-green-100';
      case 'warning': return 'text-amber-700 bg-amber-100';
      default: return 'text-red-700 bg-red-100';
    }
  };

  return (
    <div className="space-y-6">
      {/* Overall E-A-T Score */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl">
            <Shield className="w-6 h-6 text-primary" />
            E-A-T Analysis (Expertise, Authoritativeness, Trust)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Content authority evaluation for AI search and Google's Quality Rater Guidelines
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-1">
              <div className="score-display">{eatResult.overallScore || 0}</div>
              <div className="text-sm text-muted-foreground">
                E-A-T Authority Index
              </div>
            </div>
            <div className="text-right">
              <div className={`text-sm font-medium px-3 py-1 rounded-full ${getStatusColor(overallStatus)}`}>
                {overallStatus.toUpperCase()}
              </div>
            </div>
          </div>
          <Progress value={eatResult.overallScore || 0} status={overallStatus} className="h-3 mb-3" />
          
          <div className="paper-meta">
            <p className="text-sm font-medium mb-1">E-A-T Scoring Formula</p>
            <p className="text-xs text-muted-foreground">
              <strong>Expertise</strong> 40% (author credentials, topic depth) + 
              <strong>Authoritativeness</strong> 35% (citations, institutional backing) + 
              <strong>Trustworthiness</strong> 25% (contact info, transparency, security)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* E-A-T Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Expertise */}
        <Card className="metric-card">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-between text-base">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                Expertise
              </div>
              <a 
                href="https://developers.google.com/search/docs/appearance/good-page-experience#signals" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-primary hover:text-primary/80 transition-colors"
                title="Learn about expertise signals"
              >
                📖 Guide
              </a>
            </CardTitle>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Author credentials, professional background, and topic knowledge depth
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-mono text-2xl font-bold text-primary">{eatResult.expertise?.score || 0}</div>
                <div className={`text-xs font-medium px-2 py-1 rounded ${getStatusColor(expertiseStatus)}`}>
                  {expertiseStatus}
                </div>
              </div>
              
              <Progress value={eatResult.expertise?.score || 0} status={expertiseStatus} className="h-1.5" />
              
              <div className="space-y-2">
                <div className="text-xs font-medium text-foreground">Authors Detected:</div>
                {eatResult.expertise?.authors?.length > 0 ? (
                  eatResult.expertise.authors.map((author, idx) => (
                    <div key={idx} className="text-xs text-muted-foreground font-mono bg-muted/20 p-2 rounded">
                      <div className="font-medium text-foreground">{author.name || 'Unknown'}</div>
                      <div className="text-xs">Source: {author.source || 'N/A'} • Confidence: {Math.round((author.confidence || 0) * 100)}%</div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-amber-600">⚠️ No clear author attribution found</div>
                )}
                
                {eatResult.expertise.credentials.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs font-medium text-foreground mb-1">Credentials Found:</div>
                    {eatResult.expertise.credentials.map((cred, idx) => (
                      <div key={idx} className="text-xs text-muted-foreground">
                        <strong>{cred.author}:</strong> {cred.credentials.join(', ') || 'None detected'}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Authoritativeness */}
        <Card className="metric-card">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-between text-base">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-primary" />
                Authoritativeness
              </div>
              <a 
                href="https://developers.google.com/search/docs/fundamentals/creating-helpful-content" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-primary hover:text-primary/80 transition-colors"
                title="Learn about authority signals"
              >
                📖 Guide
              </a>
            </CardTitle>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Citations, institutional backing, and external recognition signals
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-mono text-2xl font-bold text-primary">{eatResult.authoritativeness.score}</div>
                <div className={`text-xs font-medium px-2 py-1 rounded ${getStatusColor(authorityStatus)}`}>
                  {authorityStatus}
                </div>
              </div>
              
              <Progress value={eatResult.authoritativeness.score} status={authorityStatus} className="h-1.5" />
              
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground font-mono">
                  📚 {eatResult.authoritativeness.citations.length} citations/references
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  🔗 {eatResult.authoritativeness.externalReferences} authoritative links
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  👤 {eatResult.authoritativeness.authorLinks} author profile links
                </div>
                {eatResult.authoritativeness.institutionalAffiliation && (
                  <div className="text-xs text-emerald-600 font-mono">
                    🏛️ Institutional affiliation detected
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trustworthiness */}
        <Card className="metric-card">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-between text-base">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                Trustworthiness
              </div>
              <a 
                href="https://developers.google.com/search/docs/fundamentals/creating-helpful-content#who-created-the-content" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-primary hover:text-primary/80 transition-colors"
                title="Learn about trust signals"
              >
                📖 Guide
              </a>
            </CardTitle>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Contact transparency, legal compliance, and security indicators
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-mono text-2xl font-bold text-primary">{eatResult.trustworthiness.score}</div>
                <div className={`text-xs font-medium px-2 py-1 rounded ${getStatusColor(trustStatus)}`}>
                  {trustStatus}
                </div>
              </div>
              
              <Progress value={eatResult.trustworthiness.score} status={trustStatus} className="h-1.5" />
              
              <div className="space-y-1">
                <div className={`text-xs font-mono flex items-center gap-1 ${
                  eatResult.trustworthiness.hasSecureConnection ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {eatResult.trustworthiness.hasSecureConnection ? '🔒' : '⚠️'} HTTPS Security
                </div>
                <div className={`text-xs font-mono flex items-center gap-1 ${
                  eatResult.trustworthiness.hasContactInfo ? 'text-emerald-600' : 'text-amber-600'
                }`}>
                  {eatResult.trustworthiness.hasContactInfo ? '📧' : '⚠️'} Contact Information
                </div>
                <div className={`text-xs font-mono flex items-center gap-1 ${
                  eatResult.trustworthiness.hasPrivacyPolicy ? 'text-emerald-600' : 'text-amber-600'
                }`}>
                  {eatResult.trustworthiness.hasPrivacyPolicy ? '📋' : '⚠️'} Privacy Policy
                </div>
                <div className={`text-xs font-mono flex items-center gap-1 ${
                  eatResult.trustworthiness.hasAboutPage ? 'text-emerald-600' : 'text-amber-600'
                }`}>
                  {eatResult.trustworthiness.hasAboutPage ? 'ℹ️' : '⚠️'} About Page
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed E-A-T Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building className="w-5 h-5" />
            E-A-T Enhancement Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* High Priority */}
            <div>
              <h4 className="font-semibold text-sm text-red-700 mb-2 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                High Priority
              </h4>
              <ul className="space-y-2">
                {eatResult.recommendations
                  .filter(rec => rec.priority === 'high')
                  .map((rec, idx) => (
                    <li key={idx} className="text-sm">
                      <div className="font-medium text-foreground">{rec.title}</div>
                      <div className="text-xs text-muted-foreground mt-1">{rec.description}</div>
                      <div className="text-xs text-red-600 font-medium mt-1">Category: {rec.category.toUpperCase()}</div>
                    </li>
                  ))}
              </ul>
            </div>

            {/* Medium Priority */}
            <div>
              <h4 className="font-semibold text-sm text-amber-700 mb-2">Medium Priority</h4>
              <ul className="space-y-2">
                {eatResult.recommendations
                  .filter(rec => rec.priority === 'medium')
                  .map((rec, idx) => (
                    <li key={idx} className="text-sm">
                      <div className="font-medium text-foreground">{rec.title}</div>
                      <div className="text-xs text-muted-foreground mt-1">{rec.description}</div>
                      <div className="text-xs text-amber-600 font-medium mt-1">Category: {rec.category.toUpperCase()}</div>
                    </li>
                  ))}
              </ul>
            </div>

            {/* Low Priority */}
            <div>
              <h4 className="font-semibold text-sm text-blue-700 mb-2">Enhancement Opportunities</h4>
              <ul className="space-y-2">
                {eatResult.recommendations
                  .filter(rec => rec.priority === 'low')
                  .map((rec, idx) => (
                    <li key={idx} className="text-sm">
                      <div className="font-medium text-foreground">{rec.title}</div>
                      <div className="text-xs text-muted-foreground mt-1">{rec.description}</div>
                      <div className="text-xs text-blue-600 font-medium mt-1">Category: {rec.category.toUpperCase()}</div>
                    </li>
                  ))}
              </ul>
            </div>
          </div>

          {/* E-A-T Context */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h5 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              About E-A-T in AI-Era SEO
            </h5>
            <p className="text-xs text-blue-700 mb-2">
              E-A-T (Expertise, Authoritativeness, Trustworthiness) is Google's framework for evaluating 
              content quality. AI systems increasingly rely on these signals to determine content credibility 
              and ranking worthiness.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-blue-700">
              <div>
                <strong>Expertise:</strong> Author credentials, topic knowledge, professional background
              </div>
              <div>
                <strong>Authority:</strong> Citations, institutional backing, external recognition
              </div>
              <div>
                <strong>Trust:</strong> Contact transparency, security, legal compliance
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Author Analysis */}
      {eatResult.expertise.authors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="w-5 h-5" />
              Author Authority Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {eatResult.expertise.authors.map((author, idx) => {
                const authorCredentials = eatResult.expertise.credentials.find(
                  cred => cred.author === author.name
                );
                
                return (
                  <div key={idx} className="p-4 bg-muted/20 rounded-lg border border-border/50">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-foreground">{author.name}</h4>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Source: {author.source}</span>
                          <span>•</span>
                          <span>Confidence: {Math.round(author.confidence * 100)}%</span>
                          {author.url && (
                            <>
                              <span>•</span>
                              <a href={author.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                Profile <ExternalLink className="w-3 h-3" />
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                      {authorCredentials && (
                        <div className="text-right">
                          <div className="text-sm font-bold text-primary">{authorCredentials.score}</div>
                          <div className="text-xs text-muted-foreground">Authority Score</div>
                        </div>
                      )}
                    </div>
                    
                    {authorCredentials?.credentials && authorCredentials.credentials.length > 0 && (
                      <div className="mb-2">
                        <div className="text-xs font-medium text-foreground mb-1">Credentials:</div>
                        <div className="flex flex-wrap gap-1">
                          {authorCredentials.credentials.map((cred, credIdx) => (
                            <span key={credIdx} className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded">
                              {cred}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {authorCredentials?.bio && (
                      <div>
                        <div className="text-xs font-medium text-foreground mb-1">Bio Extract:</div>
                        <div className="text-xs text-muted-foreground italic">
                          {authorCredentials.bio.length > 200 
                            ? authorCredentials.bio.substring(0, 200) + '...'
                            : authorCredentials.bio
                          }
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}