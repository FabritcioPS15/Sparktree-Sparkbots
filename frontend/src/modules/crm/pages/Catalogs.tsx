import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Copy } from 'lucide-react';
import { PageLoader } from '../../../components/layout/PageLoader';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageContainer } from '../../../components/layout/PageContainer';
import { PageBody } from '../../../components/layout/PageBody';
import { DataTable } from '../../../components/ui/DataTable';
import { SearchBar } from '../../../components/ui/SearchBar';
import { Dropdown } from '../../../components/ui/Dropdown';
import { ViewToggle, ViewMode } from '../../../components/ui/ViewToggle';
import { HeaderButton } from '../../../components/ui/HeaderButton';
import { CountBadge } from '../../../components/ui/CountBadge';
import { TableCard } from '../../../components/ui/TableCard';
import { KebabMenu } from '../../../components/ui/KebabMenu';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { CatalogEditor } from '../components/CatalogEditor';
import { getCatalogs, createCatalog, updateCatalog, deleteCatalog, uploadProductMedia } from '../../../services/api';
import { useNotifications } from '../../../contexts/NotificationContext';

export const Catalogs = () => {
  const [catalogs, setCatalogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingCatalog, setEditingCatalog] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const { addNotification } = useNotifications();

  useEffect(() => {
    fetchCatalogs();
  }, []);

  const fetchCatalogs = async () => {
    try {
      setLoading(true);
      const data = await getCatalogs();
      setCatalogs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch catalogs', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingCatalog({ name: '', description: '', status: 'draft', items: [] });
    setIsEditorOpen(true);
  };

  const handleEdit = (catalog: any) => {
    setEditingCatalog(catalog);
    setIsEditorOpen(true);
  };

  const handleSave = async (catalog: any) => {
    try {
      setSaving(true);
      if (catalog.id) {
        await updateCatalog(catalog.id, catalog);
      } else {
        await createCatalog(catalog);
      }
      setIsEditorOpen(false);
      await fetchCatalogs();
    } catch (error) {
      console.error('Failed to save catalog', error);
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo guardar el catálogo.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setLoading(true);
      await deleteCatalog(deleteTarget);
      await fetchCatalogs();
    } catch (error) {
      console.error('Failed to delete catalog', error);
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo eliminar el catálogo.' });
    } finally {
      setLoading(false);
      setDeleteTarget(null);
    }
  };

  const handleImageUpload = async (_itemId: string, file: File): Promise<string | null> => {
    try {
      const url = await uploadProductMedia(file);
      return url as string;
    } catch (error) {
      console.error('Upload failed', error);
      addNotification({ type: 'error', title: 'Error de imagen', message: 'Verifica el tamaño (máx 10MB) o el almacenamiento.' });
      return null;
    }
  };

  if (loading && catalogs.length === 0) return <PageLoader sectionName="Catálogos" />;

  const filteredCatalogs = (catalogs || []).filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.description?.toLowerCase().includes(search.toLowerCase())
  );

  const paginatedCatalogs = filteredCatalogs.slice((currentPage - 1) * 10, currentPage * 10);

  const columns = [
    { key: 'name', header: 'Nombre' },
    {
      key: 'description',
      header: 'Descripción',
      render: (value: string) => value ? (value.length > 50 ? value.substring(0, 50) + '...' : value) : '-'
    },
    {
      key: 'items',
      header: 'Items',
      render: (_: any, row: any) => `${row.items?.length || 0} items`
    },
    {
      key: 'status',
      header: 'Estado',
      render: (value: string) => (
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${value === 'active' ? 'bg-accent-500/10 text-accent-600 dark:text-accent-400' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
          {value === 'active' ? 'Activo' : 'Borrador'}
        </span>
      )
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      render: (_: any, catalog: any) => (
        <KebabMenu actions={[
          { label: 'Editar', icon: <Edit className="w-3.5 h-3.5" />, onClick: (e) => { e.stopPropagation(); handleEdit(catalog); } },
          { label: 'Duplicar', icon: <Copy className="w-3.5 h-3.5" />, onClick: (e) => e.stopPropagation() },
          { label: 'Eliminar', icon: <Trash2 className="w-3.5 h-3.5" />, onClick: (e) => { e.stopPropagation(); setDeleteTarget(catalog.id); }, variant: 'danger' },
        ]} />
      )
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Catálogos"
        description="Gestiona productos e inventario"
        action={
          <div className="flex items-center gap-3">
            <CountBadge count={catalogs.length} />
            <HeaderButton onClick={handleCreate} icon={<Plus className="w-4 h-4" />}>
              Nuevo Catálogo
            </HeaderButton>
          </div>
        }
      />
      <PageBody>
        <TableCard>
          {/* ── Barra de filtros unificada ── */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <SearchBar
              placeholder="Buscar catálogos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex items-center gap-2 shrink-0">
              <Dropdown
                value={filterStatus}
                onChange={setFilterStatus}
                options={[
                  { value: 'all', label: 'Todos los Estados' },
                  { value: 'active', label: 'Activo' },
                  { value: 'inactive', label: 'Inactivo' },
                ]}
              />
              <ViewToggle value={viewMode} onChange={setViewMode} />
            </div>
          </div>

          {viewMode === 'table' ? (
            <DataTable
              data={paginatedCatalogs}
              columns={columns}
              pagination={{
                currentPage,
                totalPages: Math.ceil(filteredCatalogs.length / 10) || 1,
                onPageChange: setCurrentPage,
              }}
            />
          ) : (
            <>
              {paginatedCatalogs.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <p className="font-semibold">Sin catálogos</p>
                  <p className="text-sm">Ajusta los filtros o crea uno nuevo.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {paginatedCatalogs.map((catalog) => (
                    <div
                      key={catalog.id}
                      onClick={() => handleEdit(catalog)}
                      className="group bg-white dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-4 hover:border-accent-500/40 hover:shadow-lg hover:shadow-accent-500/5 transition-all cursor-pointer"
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white text-sm leading-tight">{catalog.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                            {catalog.description || 'Sin descripción'}
                          </p>
                        </div>
                        <span className={`ml-2 shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                          catalog.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                        }`}>
                          {catalog.status === 'active' ? 'Activo' : 'Borrador'}
                        </span>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700/50">
                        <span className="text-xs font-semibold text-slate-500">{catalog.items?.length || 0} productos</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEdit(catalog); }}
                            className="p-1.5 text-slate-400 hover:text-accent-500 hover:bg-accent-500/10 rounded-lg transition-colors"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(catalog.id); }}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination grid mode */}
              {Math.ceil(filteredCatalogs.length / 10) > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  {Array.from({ length: Math.ceil(filteredCatalogs.length / 10) }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${
                        page === currentPage
                          ? 'bg-accent-500 text-black'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </TableCard>
      </PageBody>

      <CatalogEditor
        open={isEditorOpen}
        catalog={editingCatalog}
        onSave={handleSave}
        onClose={() => setIsEditorOpen(false)}
        onImageUpload={handleImageUpload}
        loading={saving}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar Catálogo"
        message="¿Estás seguro de eliminar este catálogo? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        variant="danger"
      />
    </PageContainer>
  );
};

export default Catalogs;
