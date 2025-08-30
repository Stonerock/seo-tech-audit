import { Progress } from '@/components/ui/progress';
import { Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface AuditStep {
  id: string;
  name: string;
  description: string;
  estimatedDuration: number; // in seconds
  status: 'pending' | 'running' | 'completed' | 'error';
  actualDuration?: number;
}

interface AuditProgressBarProps {
  currentStep: string;
  steps: AuditStep[];
  startTime: number;
  onCancel?: () => void;
}

export function AuditProgressBar({ currentStep, steps, startTime, onCancel }: AuditProgressBarProps) {
  const currentStepIndex = steps.findIndex(step => step.id === currentStep);
  const completedSteps = steps.filter(step => step.status === 'completed').length;
  const totalSteps = steps.length;
  const progress = (completedSteps / totalSteps) * 100;
  
  // Calculate time estimates
  const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
  const remainingSteps = steps.slice(currentStepIndex + 1);
  const remainingTime = remainingSteps.reduce((sum, step) => sum + step.estimatedDuration, 0);
  const currentStepEstimate = steps[currentStepIndex]?.estimatedDuration || 0;
  
  // Format time helper
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getStepIcon = (status: AuditStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return <div className="w-4 h-4 rounded-full border-2 border-gray-300" />;
    }
  };

  return (
    <div className="bg-background border border-border rounded-lg p-6 shadow-sm">
      {/* Progress Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
          <div>
            <h3 className="font-semibold text-foreground">Running AI Analysis</h3>
            <p className="text-sm text-muted-foreground">
              Step {currentStepIndex + 1} of {totalSteps}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>{formatTime(elapsedTime)} elapsed</span>
          </div>
          {remainingTime > 0 && (
            <div>~{formatTime(remainingTime)} remaining</div>
          )}
        </div>
      </div>

      {/* Overall Progress Bar */}
      <div className="mb-6">
        <Progress value={progress} className="h-2 mb-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{completedSteps}/{totalSteps} steps completed</span>
          <span>{Math.round(progress)}%</span>
        </div>
      </div>

      {/* Current Step Details */}
      {steps[currentStepIndex] && (
        <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
            <span className="font-medium text-blue-900">
              {steps[currentStepIndex].name}
            </span>
            <span className="text-xs text-blue-600">
              (~{currentStepEstimate}s)
            </span>
          </div>
          <p className="text-sm text-blue-700">
            {steps[currentStepIndex].description}
          </p>
        </div>
      )}

      {/* Steps Timeline */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-foreground mb-3">Analysis Steps</h4>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`flex items-center gap-3 p-2 rounded text-sm ${
                step.status === 'running' ? 'bg-blue-50' :
                step.status === 'completed' ? 'bg-emerald-50' :
                step.status === 'error' ? 'bg-red-50' :
                'bg-gray-50'
              }`}
            >
              {getStepIcon(step.status)}
              <div className="flex-1">
                <div className="font-medium">
                  {step.name}
                  {step.actualDuration && (
                    <span className="text-xs text-muted-foreground ml-2">
                      ({formatTime(step.actualDuration)})
                    </span>
                  )}
                </div>
                {step.status === 'running' && (
                  <div className="text-xs text-blue-600">
                    {step.description}
                  </div>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                ~{step.estimatedDuration}s
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cancel Button */}
      {onCancel && (
        <div className="mt-4 text-center">
          <button
            onClick={onCancel}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel Analysis
          </button>
        </div>
      )}
    </div>
  );
}

// Default audit steps configuration
// Function to get steps with adjusted timings for browserless analysis
export const getAuditSteps = (fullAnalysis = false): AuditStep[] => {
  const baseSteps = DEFAULT_AUDIT_STEPS;
  if (!fullAnalysis) return baseSteps;
  
  // Adjust timings for browserless.io analysis
  return baseSteps.map(step => {
    if (step.id === 'ai-optimization') {
      return {
        ...step,
        name: 'Enhanced AI Analysis (browserless.io)',
        description: 'Running deep JavaScript analysis with browserless.io rendering',
        estimatedDuration: 90 // Much longer for browserless analysis
      };
    }
    if (step.id === 'fetch') {
      return { ...step, estimatedDuration: 8 }; // Longer initial fetch for JS sites
    }
    return step;
  });
};

export const DEFAULT_AUDIT_STEPS: AuditStep[] = [
  {
    id: 'fetch',
    name: 'Fetching Page',
    description: 'Downloading HTML content and checking basic connectivity',
    estimatedDuration: 3,
    status: 'pending'
  },
  {
    id: 'seo',
    name: 'SEO Analysis',
    description: 'Analyzing meta tags, headings, and basic SEO elements',
    estimatedDuration: 2,
    status: 'pending'
  },
  {
    id: 'performance',
    name: 'Performance Check',
    description: 'Measuring load times and resource efficiency',
    estimatedDuration: 5,
    status: 'pending'
  },
  {
    id: 'schema',
    name: 'Schema Validation',
    description: 'Extracting and validating structured data markup',
    estimatedDuration: 4,
    status: 'pending'
  },
  {
    id: 'accessibility',
    name: 'Accessibility Analysis',
    description: 'Running WCAG compliance checks with axe-core',
    estimatedDuration: 6,
    status: 'pending'
  },
  {
    id: 'psi',
    name: 'PageSpeed Insights',
    description: 'Fetching Core Web Vitals from Google PSI API',
    estimatedDuration: 8,
    status: 'pending'
  },
  {
    id: 'ai-optimization',
    name: 'AI Optimization Analysis',
    description: 'Running comprehensive 5-category AI readiness analysis',
    estimatedDuration: 12, // Will be dynamically adjusted for browserless.io
    status: 'pending'
  },
  {
    id: 'finalize',
    name: 'Finalizing Report',
    description: 'Compiling results and generating recommendations',
    estimatedDuration: 2,
    status: 'pending'
  }
];