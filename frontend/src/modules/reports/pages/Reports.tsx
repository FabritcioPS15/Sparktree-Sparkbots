import { useState } from 'react';
import { TbReportSearch } from "react-icons/tb";
import { BarChart3, TrendingUp, FileText, Filter, Calendar, Plus } from 'lucide-react';

import { PageHeader } from '../../../components/layout/PageHeader';
import { PageContainer } from '../../../components/layout/PageContainer';
import { PageBody } from '../../../components/layout/PageBody';
import { Dropdown } from '../../../components/ui/Dropdown';
import { Modal } from '../../../components/ui/Modal';
import { useNotifications } from '../../../contexts/NotificationContext';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';

export const Reports = () => {
  const { addNotification } = useNotifications();
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [selectedReport, setSelectedReport] = useState('conversations');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('');
  const [newStartDate, setNewStartDate] = useState<dayjs.Dayjs | null>(null);
  const [newEndDate, setNewEndDate] = useState<dayjs.Dayjs | null>(null);

  const reportTypes = [
    {
      id: 'conversations',
      name: 'Reporte de Conversaciones',
      description: 'Análisis detallado de todas las conversaciones',
      icon: FileText,
      color: 'bg-black'
    },
    {
      id: 'performance',
      name: 'Reporte de Rendimiento',
      description: 'Métricas de rendimiento del chatbot',
      icon: BarChart3,
      color: 'bg-accent-500'
    },
    {
      id: 'leads',
      name: 'Reporte de Leads',
      description: 'Seguimiento de clientes potenciales',
      icon: TrendingUp,
      color: 'bg-accent-600'
    }
  ];

  const periods = [
    { value: 'week', label: 'Última semana' },
    { value: 'month', label: 'Último mes' },
    { value: 'quarter', label: 'Último trimestre' },
    { value: 'year', label: 'Último año' }
  ];

  return (
    <PageContainer>
      <PageHeader 
        title="Centro de"
        highlight="Reportes"
        description="Genera informes detallados y exporta datos estratégicos."
        icon={TbReportSearch}
      />

      <PageBody>

        {/* Controls */}
        <div className="bg-white dark:bg-dark-card/50 backdrop-blur-xl rounded-[2rem] border border-gray-200 dark:border-gray-800/50 shadow-sm p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              <Dropdown
                value={selectedPeriod}
                onChange={(v) => setSelectedPeriod(v)}
                options={periods}
              />
            </div>
            
            <button onClick={() => setShowCreateModal(true)} className="flex items-center justify-center gap-2 px-4 h-10 bg-transparent border-2 border-slate-900 dark:border-white text-emerald-600 dark:text-emerald-400 rounded-xl text-sm font-semibold transition-all duration-200 hover:bg-slate-900 dark:hover:bg-white hover:text-emerald-400 dark:hover:text-emerald-500 active:scale-95">
              <Plus className="w-4 h-4" />
              Nuevo Reporte
            </button>
          </div>
        </div>

        {/* Report Types Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {reportTypes.map((report) => {
            const Icon = report.icon;
            return (
              <button
                key={report.id}
                onClick={() => setSelectedReport(report.id)}
                className={`group p-6 rounded-[2rem] border-2 transition-all duration-200 hover:scale-105 ${
                  selectedReport === report.id
                    ? 'border-accent-500 bg-accent-500/5 dark:bg-accent-500/10 shadow-lg shadow-accent-500/20'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-black/40 backdrop-blur-xl hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-xl'
                }`}
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className={`p-3 ${report.color} rounded-xl group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white text-left">
                    {report.name}
                  </h3>
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-sm text-left">
                  {report.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* Report Content */}
        <div className="bg-white dark:bg-dark-card/50 backdrop-blur-xl rounded-[2rem] border border-gray-200 dark:border-gray-800/50 shadow-sm p-8 flex-1">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">
              {reportTypes.find(r => r.id === selectedReport)?.name}
            </h2>
            <button className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
              <Filter className="w-4 h-4" />
              Filtros
            </button>
          </div>

          {/* Sample Report Table - Mobile */}
          <div className="md:hidden space-y-3">
            {[
              { fecha: '2024-01-15', tipo: 'Conversación', desc: 'Cliente interesado en producto premium', estado: 'Completado', color: 'accent' },
              { fecha: '2024-01-14', tipo: 'Lead', desc: 'Nuevo lead potencial identificado', estado: 'En proceso', color: 'amber' },
            ].map((item, i) => (
              <div key={i} className="bg-white dark:bg-dark-card border border-gray-100 dark:border-white/5 rounded-2xl p-4 shadow-sm space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0 min-w-[80px]">Fecha</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{item.fecha}</span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0 min-w-[80px]">Tipo</span>
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full text-[11px] font-bold uppercase">{item.tipo}</span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0 min-w-[80px]">Descripción</span>
                  <span className="text-sm text-slate-600 dark:text-slate-400 text-right">{item.desc}</span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0 min-w-[80px]">Estado</span>
                  <span className={`px-2 py-0.5 bg-${item.color}-100 dark:bg-${item.color}-900/20 text-${item.color}-600 dark:text-${item.color}-400 rounded-full text-[11px] font-bold uppercase`}>{item.estado}</span>
                </div>
                <div className="flex justify-end pt-1 border-t border-gray-100 dark:border-white/5">
                  <button className="text-accent-600 dark:text-accent-400 hover:text-accent-800 font-black text-xs uppercase tracking-wider">Ver detalles</button>
                </div>
              </div>
            ))}
          </div>

          {/* Sample Report Table - Desktop */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 font-black text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">Fecha</th>
                  <th className="text-left py-3 px-4 font-black text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">Tipo</th>
                  <th className="text-left py-3 px-4 font-black text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">Descripción</th>
                  <th className="text-left py-3 px-4 font-black text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">Estado</th>
                  <th className="text-left py-3 px-4 font-black text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-emerald-50/40 dark:bg-emerald-900/5 border-b border-gray-100 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4 text-slate-900 dark:text-white font-medium">2024-01-15</td>
                  <td className="py-3 px-4">
                    <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full text-xs font-black uppercase tracking-wider">
                      Conversación
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400">Cliente interesado en producto premium</td>
                  <td className="py-3 px-4">
                    <span className="px-3 py-1 bg-accent-500/10 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400 rounded-full text-xs font-black uppercase tracking-wider">
                      Completado
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <button className="text-accent-600 dark:text-accent-400 hover:text-accent-800 dark:hover:text-accent-300 font-black text-sm uppercase tracking-wider">
                      Ver detalles
                    </button>
                  </td>
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4 text-slate-900 dark:text-white font-medium">2024-01-14</td>
                  <td className="py-3 px-4">
                    <span className="px-3 py-1 bg-secondary-100 dark:bg-secondary-900/30 text-secondary-800 dark:text-secondary-400 rounded-full text-xs font-black uppercase tracking-wider">
                      Lead
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400">Nuevo lead potencial identificado</td>
                  <td className="py-3 px-4">
                    <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 rounded-full text-xs font-black uppercase tracking-wider">
                      En proceso
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <button className="text-accent-600 dark:text-accent-400 hover:text-accent-800 dark:hover:text-accent-300 font-black text-sm uppercase tracking-wider">
                      Ver detalles
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </PageBody>

      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Nuevo Reporte"
        icon={<FileText className="w-5 h-5 text-accent-500" />}
      >
        <form onSubmit={(e) => { e.preventDefault(); addNotification({ type: 'success', title: 'Reporte creado', message: `Se ha creado el reporte ${newName}` }); setShowCreateModal(false); }} className="space-y-4">
          <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nombre del reporte" required className="w-full px-4 py-3 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-2xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all font-bold text-sm text-slate-900 dark:text-white placeholder-slate-400/60" />
          <Dropdown
            value={newType}
            onChange={v => setNewType(v)}
            placeholder="Seleccionar tipo"
            options={[
              { value: 'conversations', label: 'Conversaciones' },
              { value: 'performance', label: 'Rendimiento' },
              { value: 'leads', label: 'Leads' },
            ]}
          />
          <div className="flex gap-3">
            <DatePicker
              value={newStartDate}
              onChange={(v) => setNewStartDate(v)}
              slotProps={{ textField: { size: 'small', required: true, sx: { '& .MuiInputBase-root': { borderRadius: '16px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid #e2e8f0' } } } }}
              sx={{ width: '100%' }}
            />
            <DatePicker
              value={newEndDate}
              onChange={(v) => setNewEndDate(v)}
              slotProps={{ textField: { size: 'small', required: true, sx: { '& .MuiInputBase-root': { borderRadius: '16px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid #e2e8f0' } } } }}
              sx={{ width: '100%' }}
            />
          </div>
          <button type="submit" className="w-full py-3.5 bg-gradient-to-r from-accent-500 to-accent-600 text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:from-accent-600 hover:to-accent-700 transition-all shadow-md">Crear Reporte</button>
        </form>
      </Modal>
    </PageContainer>
  );
};

export default Reports;

