import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, Repeat2, ShoppingCart, AlertCircle } from 'lucide-react';

interface AnalysisData {
  total_customers: number;
  repeat_customers: number;
  one_time_customers: number;
  repeat_pct: string;
  avg_orders: string;
  monthly: Array<{
    month: string;
    new: number;
    repeat: number;
  }>;
  country_data: Array<{
    country: string;
    rate: number;
    repeatCount: number;
    totalCount: number;
  }>;
}

interface Props {
  data: AnalysisData;
}

export function AnalyticsDashboard({ data, children }: Props & { children?: React.ReactNode }) {
  const pieData = [
    { name: 'Repeat Customers', value: data.repeat_customers, fill: '#2563eb' },
    { name: 'One-time Buyers', value: data.one_time_customers, fill: '#93c5fd' },
  ];

  const MetricCard = ({ icon: Icon, label, value, subtext }: any) => (
    <Card className="hover:shadow-lg transition-shadow animate-slide-up">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-600">{label}</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{value}</p>
            {subtext && <p className="text-xs text-slate-500 mt-1">{subtext}</p>}
          </div>
          <div className="p-3 bg-blue-100 rounded-lg">
            <Icon className="w-6 h-6 text-blue-600" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const EmptyState = ({ title, message }: { title: string; message: string }) => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertCircle className="w-12 h-12 text-slate-300 mb-4" />
      <p className="text-slate-600 font-medium">{title}</p>
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={Users}
          label="Total Customers"
          value={data.total_customers.toLocaleString()}
        />
        <MetricCard
          icon={Repeat2}
          label="Repeat Customers"
          value={data.repeat_customers.toLocaleString()}
          subtext={`${data.repeat_pct}% of total`}
        />
        <MetricCard
          icon={ShoppingCart}
          label="One-time Buyers"
          value={data.one_time_customers.toLocaleString()}
          subtext={`${((data.one_time_customers / data.total_customers) * 100).toFixed(2)}% of total`}
        />
        <MetricCard
          icon={TrendingUp}
          label="Avg Orders/Customer"
          value={data.avg_orders}
        />
      </div>

      {/* Slot for AI chat or other content between metrics and charts */}
      {children}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <Card className="hover:shadow-lg transition-shadow animate-slide-up">
          <CardHeader>
            <CardTitle className="text-lg">Customer Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {data.total_customers > 0 ? (
              <div className="h-80 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value.toLocaleString()}`}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => value.toLocaleString()} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState
                title="No data available"
                message="Unable to generate customer breakdown"
              />
            )}
          </CardContent>
        </Card>

        {/* Bar Chart */}
        <Card className="hover:shadow-lg transition-shadow animate-slide-up">
          <CardHeader>
            <CardTitle className="text-lg">Monthly Trends</CardTitle>
          </CardHeader>
          <CardContent>
            {data.monthly && data.monthly.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                      }}
                      formatter={(value) => value.toLocaleString()}
                    />
                    <Legend />
                    <Bar dataKey="new" stackId="a" fill="#93c5fd" name="New Customers" />
                    <Bar dataKey="repeat" stackId="a" fill="#2563eb" name="Repeat Customers" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState
                title="No monthly data"
                message="Invoice dates not found in your dataset"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Country Breakdown */}
      <Card className="hover:shadow-lg transition-shadow animate-slide-up">
        <CardHeader>
          <CardTitle className="text-lg">Repeat Rate by Country</CardTitle>
        </CardHeader>
        <CardContent>
          {data.country_data && data.country_data.length > 0 ? (
            <div className="space-y-4">
              {data.country_data.map((country, index) => (
                <div key={index} className="animate-slide-up" style={{ animationDelay: `${index * 50}ms` }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{country.country}</p>
                      <p className="text-xs text-slate-500">
                        {country.repeatCount} repeat out of {country.totalCount} customers
                      </p>
                    </div>
                    <p className="text-lg font-bold text-blue-600 min-w-fit ml-4">
                      {country.rate.toFixed(2)}%
                    </p>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(country.rate, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No country data"
              message="Country information not found in your dataset"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
