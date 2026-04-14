import { useState, useMemo, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/hooks/useActivityLog";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { SortableTableHead, useTableSort } from "@/components/SortableTableHead";
import { Plus, Pencil, Trash2, Eye, Upload, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { inputClass, labelClass } from "@/lib/ui-constants";
import { useFormValidation, fieldClass, FieldError, FormErrorBanner } from "@/hooks/useFormValidation";

interface Announcement {
  id: string;
  title: string;
  description: string;
  image_url: string;
  link: string;
  active: boolean;
  use_as_banner: boolean;
  use_as_popup: boolean;
  popup_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const emptyForm = {
  title: "", description: "", image_url: "", link: "",
  active: true, use_as_banner: false, use_as_popup: false, popup_order: 0,
};

export function AnnouncementsContent({ isAgent = false }: { isAgent?: boolean }) {
  const { user, role } = useAuth();
  const isAdmin = role === "admin" || role === "super_admin";
  const queryClient = useQueryClient();
  const ic = inputClass;
  const lbl = labelClass;

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Announcement[];
    },
  });

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const { sort, handleSort, sortData } = useTableSort("created_at", "desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [viewItem, setViewItem] = useState<Announcement | null>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const [uploadingImg, setUploadingImg] = useState(false);

  const filtered = useMemo(() => {
    let list = announcements;
    if (activeFilter !== "all") list = list.filter(a => activeFilter === "active" ? a.active : !a.active);
    if (typeFilter !== "all") {
      if (typeFilter === "banner") list = list.filter(a => a.use_as_banner);
      else if (typeFilter === "popup") list = list.filter(a => a.use_as_popup);
      else if (typeFilter === "both") list = list.filter(a => a.use_as_banner && a.use_as_popup);
    }
    if (dateFrom) list = list.filter(a => a.created_at >= dateFrom);
    if (dateTo) list = list.filter(a => a.created_at <= dateTo + "T23:59:59");
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(a => a.title.toLowerCase().includes(s) || a.description.toLowerCase().includes(s));
    }
    return sortData(list, (a: Announcement, key: string) => {
      const m: Record<string, any> = { title: a.title, active: a.active ? "1" : "0", created_at: a.created_at };
      return m[key] ?? "";
    });
  }, [announcements, activeFilter, typeFilter, dateFrom, dateTo, search, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const openCreate = () => { setEditingId(null); setForm({ ...emptyForm }); setShowForm(true); };
  const openEdit = (a: Announcement) => {
    setEditingId(a.id);
    setForm({ title: a.title, description: a.description, image_url: a.image_url, link: a.link, active: a.active, use_as_banner: a.use_as_banner, use_as_popup: a.use_as_popup, popup_order: a.popup_order });
    setShowForm(true);
  };

  const uploadImage = async (file: File) => {
    setUploadingImg(true);
    try {
      const path = `announcements/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("room-photos").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("room-photos").getPublicUrl(path);
      setForm(f => ({ ...f, image_url: publicUrl }));
      toast.success("Image uploaded");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploadingImg(false);
    }
  };

  const { errors, validate, clearError, clearAllErrors } = useFormValidation();

  const handleSave = async () => {
    const rules = { title: (v: any) => !form.title.trim() ? "Title is required" : null };
    if (!validate({ title: form.title }, rules)) return;
    setSaving(true);
    try {
      if (editingId) {
        await supabase.from("announcements").update({ ...form, updated_at: new Date().toISOString() }).eq("id", editingId);
        await logActivity("edit_announcement", "announcement", editingId, { title: form.title });
        toast.success("Announcement updated");
      } else {
        await supabase.from("announcements").insert({ ...form, created_by: user?.id });
        await logActivity("create_announcement", "announcement", "", { title: form.title });
        toast.success("Announcement created");
      }
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      setShowForm(false);
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await supabase.from("announcements").delete().eq("id", deleteTarget.id);
      await logActivity("delete_announcement", "announcement", deleteTarget.id, { title: deleteTarget.title });
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      toast.success("Announcement deleted");
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error(e.message || "Failed");
    }
  };

  // Agent view: show active banners and popups
  if (isAgent) {
    const banners = announcements.filter(a => a.active && a.use_as_banner);
    const popups = announcements.filter(a => a.active && a.use_as_popup).sort((a, b) => a.popup_order - b.popup_order);
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold">Announcements</h2>
        {banners.length > 0 && (
          <div className="space-y-3">
            {banners.map(b => (
              <div key={b.id} className="rounded-lg border bg-primary/5 border-primary/20 p-4">
                <div className="flex items-start gap-4">
                  {b.image_url && <img src={b.image_url} alt="" className="w-16 h-16 rounded object-cover flex-shrink-0" />}
                  <div>
                    <div className="font-bold text-foreground">{b.title}</div>
                    <div className="text-sm text-muted-foreground mt-1">{b.description}</div>
                    {b.link && <a href={b.link} target="_blank" rel="noreferrer" className="text-primary text-xs underline mt-2 inline-block">Learn more →</a>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {popups.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-muted-foreground text-sm uppercase">Important Notices</h3>
            {popups.map(p => (
              <div key={p.id} className="rounded-lg border bg-card p-4">
                {p.image_url && <img src={p.image_url} alt="" className="w-full max-h-40 rounded object-cover mb-3" />}
                <div className="font-bold">{p.title}</div>
                <div className="text-sm text-muted-foreground mt-1">{p.description}</div>
                {p.link && <a href={p.link} target="_blank" rel="noreferrer" className="text-primary text-xs underline mt-2 inline-block">Learn more →</a>}
              </div>
            ))}
          </div>
        )}
        {banners.length === 0 && popups.length === 0 && (
          <div className="py-10 text-center text-muted-foreground">No announcements right now.</div>
        )}
      </div>
    );
  }

  const hasFilters = activeFilter !== "all" || typeFilter !== "all" || Boolean(dateFrom) || Boolean(dateTo) || search.trim() !== "";

  return (
    <div className="space-y-4">
      <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ""; }} />

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={open => !saving && setShowForm(open)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] p-0" onPointerDownOutside={e => e.preventDefault()}>
          <DialogHeader className="px-6 pt-6 pb-0"><DialogTitle>{editingId ? "Edit" : "Create"} Announcement</DialogTitle></DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-80px)] px-6 pb-6">
            <div className="space-y-4 py-4">
              <FormErrorBanner errors={errors} />
              <div className="space-y-1" data-field="title"><label className={lbl}>Title *</label><input className={fieldClass(`${ic} w-full`, !!errors.title)} value={form.title} onChange={e => { setForm({ ...form, title: e.target.value }); clearError("title"); }} /><FieldError error={errors.title} /></div>
              <div className="space-y-1"><label className={lbl}>Description</label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} /></div>
              <div className="space-y-1">
                <label className={lbl}>Image</label>
                {form.image_url ? (
                  <div className="space-y-2">
                    <img src={form.image_url} alt="" className="w-full max-h-32 rounded object-cover" />
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => imgRef.current?.click()} disabled={uploadingImg}>{uploadingImg ? "Uploading..." : "Replace"}</Button>
                      <Button variant="ghost" size="sm" onClick={() => setForm({ ...form, image_url: "" })}>Remove</Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => imgRef.current?.click()} disabled={uploadingImg}><Upload className="h-3 w-3 mr-1" />{uploadingImg ? "Uploading..." : "Upload Image"}</Button>
                )}
              </div>
              <div className="space-y-1"><label className={lbl}>Link (optional)</label><input className={`${ic} w-full`} placeholder="https://..." value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-4">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Active</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.use_as_banner} onChange={e => setForm({ ...form, use_as_banner: e.target.checked })} /> Banner</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.use_as_popup} onChange={e => setForm({ ...form, use_as_popup: e.target.checked })} /> Popup</label>
              </div>
              {form.use_as_popup && (
                <div className="space-y-1"><label className={lbl}>Popup Order</label><input className={`${ic} w-24`} type="number" value={form.popup_order} onChange={e => setForm({ ...form, popup_order: Number(e.target.value) })} /></div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter className="px-6 pb-6">
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : editingId ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      {viewItem && (
        <Dialog open={Boolean(viewItem)} onOpenChange={open => !open && setViewItem(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>{viewItem.title}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {viewItem.image_url && <img src={viewItem.image_url} alt="" className="w-full max-h-48 rounded object-cover" />}
              <p className="text-sm text-muted-foreground">{viewItem.description || "No description"}</p>
              {viewItem.link && <a href={viewItem.link} target="_blank" rel="noreferrer" className="text-primary text-sm underline">Open link →</a>}
              <div className="flex flex-wrap gap-2 text-xs">
                {viewItem.active ? <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Active</span> : <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Inactive</span>}
                {viewItem.use_as_banner && <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Banner</span>}
                {viewItem.use_as_popup && <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">Popup (#{viewItem.popup_order})</span>}
              </div>
              <p className="text-xs text-muted-foreground">Created: {format(new Date(viewItem.created_at), "dd MMM yyyy, HH:mm")}</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewItem(null)}>Close</Button>
              {isAdmin && <Button onClick={() => { setViewItem(null); openEdit(viewItem); }}>Edit</Button>}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Dialog */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Announcement?</AlertDialogTitle>
            <AlertDialogDescription>Delete "{deleteTarget?.title}"? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Announcements</h2>
        {isAdmin && <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Create</Button>}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Input placeholder="Search title..." className="max-w-xs" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
        <Select value={activeFilter} onValueChange={v => { setActiveFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="banner">Banner</SelectItem>
            <SelectItem value="popup">Popup</SelectItem>
            <SelectItem value="both">Both</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); }} className="h-10 w-[140px]" placeholder="From" />
        <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0); }} className="h-10 w-[140px]" placeholder="To" />
        {hasFilters && <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setActiveFilter("all"); setTypeFilter("all"); setDateFrom(""); setDateTo(""); setPage(0); }}><X className="h-3 w-3 mr-1" /> Clear</Button>}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="py-10 text-center text-muted-foreground">Loading...</div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead sortKey="title" currentSort={sort} onSort={handleSort}>Title</SortableTableHead>
                <TableHead>Summary</TableHead>
                <SortableTableHead sortKey="active" currentSort={sort} onSort={handleSort}>Active</SortableTableHead>
                <TableHead>Banner</TableHead>
                <TableHead>Popup</TableHead>
                <SortableTableHead sortKey="created_at" currentSort={sort} onSort={handleSort}>Created</SortableTableHead>
                {isAdmin && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow><TableCell colSpan={isAdmin ? 7 : 6} className="text-center text-muted-foreground py-8">No announcements</TableCell></TableRow>
              ) : paged.map(a => (
                <TableRow key={a.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setViewItem(a)}>
                  <TableCell className="font-medium">{a.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{a.description || "—"}</TableCell>
                  <TableCell>
                    {a.active ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Yes</span> : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">No</span>}
                  </TableCell>
                  <TableCell>{a.use_as_banner ? "✅" : "—"}</TableCell>
                  <TableCell>{a.use_as_popup ? `✅ #${a.popup_order}` : "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{format(new Date(a.created_at), "dd MMM yyyy")}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" onClick={() => setViewItem(a)}><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(a)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Show</span>
          <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(0); }}>
            <SelectTrigger className="w-[70px] h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <span>of {filtered.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="px-2">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}
