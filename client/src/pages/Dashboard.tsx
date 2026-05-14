import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Upload, Loader2, CheckCircle, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/lib/trpc';
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard';
import { AIChatBox, Message } from '@/components/AIChatBox';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';

interface AnalysisData {
  total_customers: number;
  repeat_customers: number;
  one_time_customers: number;
  repeat_pct: string;
  avg_orders: string;
  monthly: Array<{ month: string; new: number; repeat: number }>;
  country_data: Array<{ country: string; rate: number; repeatCount: number; totalCount: number }>;
}

function buildSystemPrompt(data: AnalysisData, fileName: string): string {
  const topCountries = data.country_data.slice(0, 5)
    .map(c => `${c.country}: ${c.rate}% repeat rate (${c.repeatCount}/${c.totalCount} customers)`)
    .join(', ');

  const monthlyBreakdown = data.monthly.slice(-12).map(m =>
    `${m.month}: ${m.repeat} repeat, ${m.new} new`).join(' | ');

  return `You are Optimus Prime, a customer analytics expert AI helping analyze retail data from "${fileName}".

Dataset summary:
- Total unique customers: ${data.total_customers.toLocaleString()}
- Repeat customers (2+ orders): ${data.repeat_customers.toLocaleString()} (${data.repeat_pct}% of total)
- One-time buyers: ${data.one_time_customers.toLocaleString()} (${((data.one_time_customers / data.total_customers) * 100).toFixed(2)}% of total)
- Average orders per customer: ${data.avg_orders}
- Date range: ${data.monthly[0]?.month ?? 'N/A'} to ${data.monthly[data.monthly.length-1]?.month ?? 'N/A'} (${data.monthly.length} months)
- Monthly trend (last 12 months): ${monthlyBreakdown || 'N/A'}
- Top countries by volume: ${topCountries || 'N/A'}

Answer questions about this data clearly and concisely. Always refer to yourself as Optimus Prime. Provide actionable business insights. If asked about something outside this dataset, say so honestly.`;
}

export default function Dashboard() {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showChat, setShowChat] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = trpc.analysis.uploadAndAnalyze.useMutation();
  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (data) => {
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    },
    onError: (err) => {
      toast.error(err.message);
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    },
  });

  const handleFileSelect = async (file: File) => {
    setError('');
    if (!file.name.endsWith('.csv')) {
      const msg = 'Please upload a CSV file';
      setError(msg); toast.error(msg); return;
    }
    if (file.size === 0) {
      const msg = 'File cannot be empty';
      setError(msg); toast.error(msg); return;
    }
    try {
      const content = await file.text();
      if (!content.trim()) {
        const msg = 'CSV file appears to be empty';
        setError(msg); toast.error(msg); return;
      }
      setFileName(file.name);
      const toastId = toast.loading('Analyzing your data...');
      const result = await uploadMutation.mutateAsync({ fileName: file.name, csvContent: content });
      setAnalysisData(result);
      setMessages([{ role: 'system', content: buildSystemPrompt(result, file.name) }]);
      toast.success('Analysis complete!', { id: toastId });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to analyze CSV';
      setError(message);
      setFileName('');
      toast.dismiss();
      toast.error(message);
    }
  };

  const handleSendMessage = (content: string) => {
    const newMessages: Message[] = [...messages, { role: 'user', content }];
    setMessages(newMessages);
    chatMutation.mutate({ messages: newMessages });
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleReset = () => {
    setAnalysisData(null); setFileName(''); setError('');
    setMessages([]); setShowChat(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (analysisData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 sm:p-6 lg:p-8 animate-fade-in">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-slide-up">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">Customer Analytics</h1>
              </div>
              <p className="text-slate-600 mt-2 text-sm sm:text-base">
                Analysis of: <span className="font-semibold">{fileName}</span>
              </p>
            </div>
            <Button onClick={handleReset} variant="outline" className="w-full sm:w-auto">
              Upload New File
            </Button>
          </div>

          <AnalyticsDashboard data={analysisData}>
          {/* AI Chat Section — between metrics and charts */}
          <div className="animate-slide-up">
            <button
              onClick={() => setShowChat(!showChat)}
              className="w-full flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-slate-900">Optimus Prime</p>
                  <p className="text-sm text-slate-500">Your AI analytics assistant — ask anything</p>
                </div>
              </div>
              {showChat ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </button>

            {showChat && (
              <div className="mt-3 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <AIChatBox
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  isLoading={chatMutation.isPending}
                  height="450px"
                  placeholder="Ask Optimus Prime anything..."
                  emptyStateMessage="Hi! I'm Optimus Prime. Ask me anything about your customer data."
                  suggestedPrompts={[
                    `Why is the repeat rate ${analysisData.repeat_pct}%?`,
                    'Which country has the best retention?',
                    'How can I improve repeat purchases?',
                    'What does the monthly trend tell us?',
                  ]}
                />
              </div>
            )}
          </div>
          </AnalyticsDashboard>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-12 animate-slide-up">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">Customer Analytics</h1>
          <p className="text-lg text-slate-600">Upload your customer transaction data to analyze repeat customer metrics</p>
        </div>

        <Card className="border-2 border-dashed border-slate-300 hover:border-blue-400 transition-colors animate-slide-up">
          <CardContent className="p-8 sm:p-12">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              role="button" tabIndex={0}
              aria-label="Drop CSV file here or click to select"
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
              className={`text-center cursor-pointer transition-all rounded-lg p-6 ${isDragging ? 'bg-blue-50 border-blue-400' : ''}`}
            >
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Upload className="w-8 h-8 text-blue-600" />
                </div>
              </div>
              <h2 className="text-2xl font-semibold text-slate-900 mb-2">Drag and drop your CSV file</h2>
              <p className="text-slate-600 mb-6">or click the button below to select a file</p>
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={uploadMutation.isPending}
              >
                {uploadMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing...</>
                ) : (
                  <><Upload className="w-4 h-4 mr-2" />Choose CSV File</>
                )}
              </Button>
              <input
                ref={fileInputRef} type="file" accept=".csv"
                aria-label="CSV file input"
                onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileSelect(file); }}
                className="hidden"
              />
              <p className="text-sm text-slate-500 mt-6 leading-relaxed">
                <strong>Supported format:</strong> CSV files with Customer ID and Invoice columns
                <br /><span className="text-xs">Example: Online Retail II dataset</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive" className="mt-6 animate-slide-up">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription><strong>Error:</strong> {error}</AlertDescription>
          </Alert>
        )}

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { title: 'Supported Format', desc: 'CSV files, any size' },
            { title: 'Required Columns', desc: 'Customer ID, Invoice' },
            { title: 'Optional Columns', desc: 'Country, Invoice Date' },
          ].map((item, i) => (
            <Card key={i} className="bg-white/50 backdrop-blur animate-slide-up" style={{ animationDelay: `${(i + 1) * 50}ms` }}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-700">{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
