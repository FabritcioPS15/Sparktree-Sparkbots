import { useState, useEffect } from 'react';
import {
  Plus, Search, Trash2,
  Upload, Link, FileText, Database,
  Play
} from 'lucide-react';
import { Loader } from '../../../components/ui/Loader';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useNotifications } from '../../../contexts/NotificationContext';
import { getKnowledgeBases, createKnowledgeBase, deleteKnowledgeBase, getKnowledgeDocuments, addDocument, deleteDocument, ragQuery } from '../../../services/api';

interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  documentCount: number;
  chunkSize: number;
  chunkOverlap: number;
  createdAt: string;
  updatedAt: string;
}

interface Document {
  id: string;
  title: string;
  type: 'text' | 'url' | 'file';
  status: 'processing' | 'ready' | 'error';
  chunkCount: number;
  createdAt: string;
}

export const KnowledgeBases = () => {
  const { addNotification } = useNotifications();
  const [bases, setBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [selectedBase, setSelectedBase] = useState<KnowledgeBase | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docContent, setDocContent] = useState('');
  const [docUrl, setDocUrl] = useState('');
  const [docTab, setDocTab] = useState<'text' | 'url'>('text');
  const [ragQuery_text, setRagQuery_text] = useState('');
  const [ragResult, setRagResult] = useState<any>(null);
  const [ragLoading, setRagLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteDocTarget, setDeleteDocTarget] = useState<string | null>(null);

  useEffect(() => {
    loadBases();
  }, []);

  const loadBases = async () => {
    setLoading(true);
    try {
      const data = await getKnowledgeBases();
      setBases(data);
    } catch (err) {
      console.error('Error loading knowledge bases:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const kb = await createKnowledgeBase({ name: newName, description: newDesc });
      setBases(prev => [...prev, kb]);
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      addNotification?.({ type: 'success', title: 'Base de conocimiento creada', message: `Se creó "${newName}".` });
    } catch (err) {
      addNotification?.({ type: 'error', title: 'Error al crear base de conocimiento', message: 'No se pudo crear la base.' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteKnowledgeBase(deleteTarget);
      setBases(prev => prev.filter(b => b.id !== deleteTarget));
      if (selectedBase?.id === deleteTarget) setSelectedBase(null);
      addNotification?.({ type: 'success', title: 'Base eliminada', message: 'La base se eliminó correctamente.' });
    } catch (err) {
      addNotification?.({ type: 'error', title: 'Error al eliminar', message: 'No se pudo eliminar la base.' });
    } finally {
      setDeleteTarget(null);
    }
  };

  const selectBase = async (base: KnowledgeBase) => {
    setSelectedBase(base);
    setDocsLoading(true);
    setDocuments([]);
    setRagResult(null);
    try {
      const docs = await getKnowledgeDocuments(base.id);
      setDocuments(docs);
    } catch (err) {
      console.error('Error loading documents:', err);
    } finally {
      setDocsLoading(false);
    }
  };

  const handleAddDocument = async () => {
    if (!selectedBase) return;
    if (docTab === 'text' && !docTitle.trim()) return;
    if (docTab === 'url' && !docUrl.trim()) return;
    try {
      if (docTab === 'text') {
        await addDocument(selectedBase.id, { title: docTitle, content: docContent, type: 'text' });
      } else {
        await addDocument(selectedBase.id, { title: docUrl, url: docUrl, type: 'url' });
      }
      setShowAddDoc(false);
      setDocTitle('');
      setDocContent('');
      setDocUrl('');
      addNotification?.({ type: 'success', title: 'Documento agregado', message: 'El documento se agregó correctamente.' });
      selectBase(selectedBase);
    } catch (err) {
      addNotification?.({ type: 'error', title: 'Error al agregar documento', message: 'No se pudo agregar el documento.' });
    }
  };

  const handleDeleteDoc = async () => {
    if (!selectedBase || !deleteDocTarget) return;
    try {
      await deleteDocument(selectedBase.id, deleteDocTarget);
      setDocuments(prev => prev.filter(d => d.id !== deleteDocTarget));
      addNotification?.({ type: 'success', title: 'Documento eliminado', message: 'El documento se eliminó correctamente.' });
      selectBase(selectedBase);
    } catch (err) {
      addNotification?.({ type: 'error', title: 'Error al eliminar documento', message: 'No se pudo eliminar el documento.' });
    } finally {
      setDeleteDocTarget(null);
    }
  };

  const handleRagQuery = async () => {
    if (!selectedBase || !ragQuery_text.trim()) return;
    setRagLoading(true);
    try {
      const result = await ragQuery({ knowledgeBaseId: selectedBase.id, query: ragQuery_text });
      setRagResult(result);
    } catch (err) {
      addNotification?.({ type: 'error', title: 'Error en consulta RAG', message: 'No se pudo procesar la consulta.' });
    } finally {
      setRagLoading(false);
    }
  };

  const filtered = bases.filter(b =>
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
    <div className="flex flex-col md:flex-row h-full bg-slate-50 dark:bg-[#1a1a1a]">
      <div className="w-full md:w-[420px] shrink-0 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-dark-card flex flex-col">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-teal-500/10 rounded-xl">
                <Database className="w-5 h-5 text-teal-500" />
              </div>
              <div>
                <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Knowledge Bases</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">RAG</p>
              </div>
            </div>
            <button onClick={() => setShowCreate(true)}
              className="p-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl hover:bg-slate-800 dark:hover:bg-slate-100 transition-all">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar bases..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader size="md" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Database className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-400">Sin bases de conocimiento</p>
              <p className="text-[10px] text-slate-400 mt-1">Crea una base para empezar</p>
            </div>
          ) : filtered.map(base => (
            <button key={base.id} onClick={() => selectBase(base)}
              className={`w-full text-left p-4 rounded-2xl border transition-all ${
                selectedBase?.id === base.id
                  ? 'bg-teal-50 dark:bg-teal-500/10 border-teal-200 dark:border-teal-800/50 shadow-sm'
                  : 'bg-white dark:bg-white/5 border-slate-100 dark:border-slate-800 hover:border-teal-200 dark:hover:border-teal-800/50'
              }`}>
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="font-black text-sm text-slate-900 dark:text-white truncate">{base.name}</h3>
                  {base.description && (
                    <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{base.description}</p>
                  )}
                </div>
                <button onClick={e => { e.stopPropagation(); setDeleteTarget(base.id); }}
                  className="p-1.5 text-slate-300 hover:text-red-500 transition-colors shrink-0 ml-2">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-3 mt-3 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                <span>{base.documentCount || 0} docs</span>
                <span>chunk: {base.chunkSize || 500}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white dark:bg-dark-card">
        {selectedBase ? (
          <>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-500/10 rounded-lg">
                  <Database className="w-4 h-4 text-teal-500" />
                </div>
                <div>
                  <h2 className="font-black text-base text-slate-900 dark:text-white">{selectedBase.name}</h2>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{selectedBase.documentCount || 0} documentos</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowAddDoc(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-100 transition-all">
                  <Plus className="w-3.5 h-3.5" />
                  Agregar Documento
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-widest mb-4">Documentos</h3>
                  {docsLoading ? (
                    <div className="flex items-center justify-center py-8">
                       <Loader size="sm" />
                    </div>
                  ) : documents.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                      <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                      <p className="text-sm font-bold text-slate-400">Sin documentos</p>
                      <button onClick={() => setShowAddDoc(true)}
                        className="mt-2 text-[10px] font-black uppercase tracking-widest text-teal-500 hover:text-teal-600">
                        Agregar documento
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {documents.map(doc => (
                        <div key={doc.id}
                          className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-700">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`p-2 rounded-lg ${
                              doc.type === 'text' ? 'bg-blue-500/10' :
                              doc.type === 'url' ? 'bg-orange-500/10' : 'bg-amber-500/10'
                            }`}>
                              {doc.type === 'text' ? <FileText className="w-3.5 h-3.5 text-blue-500" /> :
                               doc.type === 'url' ? <Link className="w-3.5 h-3.5 text-orange-500" /> :
                               <Upload className="w-3.5 h-3.5 text-amber-500" />}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{doc.title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-[8px] font-black uppercase tracking-widest ${
                                  doc.status === 'ready' ? 'text-emerald-500' :
                                  doc.status === 'processing' ? 'text-amber-500' : 'text-red-500'
                                }`}>{doc.status}</span>
                                <span className="text-[8px] text-slate-400">{doc.chunkCount || 0} chunks</span>
                              </div>
                            </div>
                          </div>
                          <button onClick={() => setDeleteDocTarget(doc.id)}
                            className="p-1.5 text-slate-300 hover:text-red-500 transition-colors shrink-0">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                  <h3 className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-widest mb-4">Probar RAG Query</h3>
                  <div className="flex gap-3">
                    <input type="text" value={ragQuery_text} onChange={e => setRagQuery_text(e.target.value)}
                      placeholder="Escribe una consulta de prueba..."
                      className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none"
                      onKeyDown={e => e.key === 'Enter' && handleRagQuery()} />
                    <button onClick={handleRagQuery} disabled={ragLoading}
                      className="px-5 py-2.5 bg-teal-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-teal-600 transition-all disabled:opacity-50 flex items-center gap-2">
                      {ragLoading ? <Loader size="xs" /> : <Play className="w-3.5 h-3.5" />}
                      Probar
                    </button>
                  </div>
                  {ragResult && (
                    <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700">
                      <h4 className="font-black text-[10px] text-slate-500 uppercase tracking-widest mb-2">Resultados</h4>
                      {ragResult.context && (
                        <p className="text-sm text-slate-700 dark:text-slate-300 mb-3 leading-relaxed">{ragResult.context}</p>
                      )}
                      {ragResult.sources && ragResult.sources.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Fuentes ({ragResult.sources.length})</p>
                          {ragResult.sources.map((s: any, i: number) => (
                            <div key={i} className="flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                              <span className="text-xs text-slate-700 dark:text-slate-300 font-medium truncate">{s.title || s.content?.substring(0, 60)}</span>
                              <span className="text-[9px] font-bold text-teal-500 shrink-0 ml-2">{(s.similarity * 100).toFixed(0)}%</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Database className="w-16 h-16 text-slate-200 dark:text-slate-700 mx-auto mb-4" />
              <h2 className="text-lg font-black text-slate-400 dark:text-slate-500">Selecciona una base</h2>
              <p className="text-xs text-slate-400 mt-1">o crea una nueva desde el panel izquierdo</p>
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-[100000] bg-black/50 flex items-center justify-center" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-dark-card rounded-2xl shadow-2xl w-[420px] p-6" onClick={e => e.stopPropagation()}>
            <h2 className="font-black text-lg text-slate-900 dark:text-white mb-4">Nueva Base de Conocimiento</h2>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Nombre</label>
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)} autoFocus
                  className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none"
                  placeholder="Ej: Productos, FAQ, Políticas..." />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Descripción</label>
                <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={3}
                  className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none resize-none"
                  placeholder="¿Qué información contiene esta base?" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreate(false)}
                className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors">Cancelar</button>
              <button onClick={handleCreate} disabled={!newName.trim()}
                className="px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50">
                Crear Base
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddDoc && selectedBase && (
        <div className="fixed inset-0 z-[100000] bg-black/50 flex items-center justify-center" onClick={() => setShowAddDoc(false)}>
          <div className="bg-white dark:bg-dark-card rounded-2xl shadow-2xl w-[480px] p-6" onClick={e => e.stopPropagation()}>
            <h2 className="font-black text-lg text-slate-900 dark:text-white mb-4">Agregar Documento</h2>
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 mb-4">
              <button onClick={() => setDocTab('text')}
                className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  docTab === 'text' ? 'bg-white dark:bg-dark-card text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'
                }`}>
                <FileText className="w-3.5 h-3.5 inline mr-1.5" />Texto
              </button>
              <button onClick={() => setDocTab('url')}
                className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  docTab === 'url' ? 'bg-white dark:bg-dark-card text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'
                }`}>
                <Link className="w-3.5 h-3.5 inline mr-1.5" />URL
              </button>
            </div>
            {docTab === 'text' ? (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Título</label>
                  <input type="text" value={docTitle} onChange={e => setDocTitle(e.target.value)} autoFocus
                    className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Contenido</label>
                  <textarea value={docContent} onChange={e => setDocContent(e.target.value)} rows={8}
                    className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none resize-none font-mono"
                    placeholder="Pega el contenido del documento aquí..." />
                </div>
              </div>
            ) : (
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">URL del documento</label>
                <input type="url" value={docUrl} onChange={e => setDocUrl(e.target.value)} autoFocus
                  className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none"
                  placeholder="https://..." />
              </div>
            )}
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowAddDoc(false)}
                className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors">Cancelar</button>
              <button onClick={handleAddDocument}
                className="px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all">
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar base de conocimiento"
        message="¿Eliminar esta base de conocimiento? Todos los documentos se perderán. Esta acción no se puede deshacer."
        confirmText="Eliminar"
        variant="danger"
      />
      <ConfirmDialog
        open={!!deleteDocTarget}
        onClose={() => setDeleteDocTarget(null)}
        onConfirm={handleDeleteDoc}
        title="Eliminar documento"
        message="¿Eliminar este documento? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        variant="danger"
      />
    </>
  );
};
