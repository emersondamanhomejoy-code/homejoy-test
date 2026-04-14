import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useLocations, useCreateLocation, useUpdateLocation, useDeleteLocation } from "@/hooks/useLocations";
import { useCondos } from "@/hooks/useCondos";
import { useUnits } from "@/hooks/useRooms";
import { Table, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SortableTableHead, useTableSort } from "@/components/SortableTableHead";
import { StandardPageLayout } from "@/components/ui/standard-page-layout";
import { StandardModal } from "@/components/ui/standard-modal";
import { StandardTable } from "@/components/ui/standard-table";
import { StandardFilterBar } from "@/components/ui/standard-filter-bar";
import { ActionButtons } from "@/components/ui/action-buttons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { inputClass } from "@/lib/ui-constants";
import { useFormValidation, fieldClass, FieldError, FormErrorBanner } from "@/hooks/useFormValidation";

export function LocationsContent() {
  const { data: locations = [], isLoading } = useLocations();
  const { data: condos = [] } = useCondos();
  const { data: units = [] } = useUnits();
  const createLocation = useCreateLocation();
  const updateLocation = useUpdateLocation();
  const deleteLocation = useDeleteLocation();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [initialName, setInitialName] = useState("");
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { errors, validate, clearError, clearAllErrors } = useFormValidation();

  const locationStats = useMemo(() => {
    const map: Record<string, { buildings: number; units: number; rooms: number }> = {};
    for (const loc of locations) {
      const locCondos = condos.filter(c => c.location_id === loc.id);
      const buildingNames = new Set(locCondos.map(c => c.name));
      const locUnits = units.filter(u => buildingNames.has(u.building));
      const rooms = locUnits.flatMap(u => (u.rooms || []).filter(r => r.room_type !== "Car Park"));
      map[loc.id] = { buildings: locCondos.length, units: locUnits.length, rooms: rooms.length };
    }
    return map;
  }, [locations, condos, units]);

  const openCreate = () => { setEditingId(null); setName(""); setInitialName(""); clearAllErrors(); setShowForm(true); };
  const openEdit = (loc: { id: string; name: string }) => { setEditingId(loc.id); setName(loc.name); setInitialName(loc.name); clearAllErrors(); setShowForm(true); };

  const handleSave = async () => {
    const rules = { name: (v: any) => !name.trim() ? "Location name is required" : null };
    if (!validate({ name }, rules)) return;
    try {
      if (editingId) {
        await updateLocation.mutateAsync({ id: editingId, name: name.trim() });
      } else {
        await createLocation.mutateAsync(name.trim());
      }
      setShowForm(false);
    } catch (e: any) { toast.error(e.message || "Failed to save location"); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try { await deleteLocation.mutateAsync(deleteId); } catch (e: any) { toast.error(e.message || "Failed to delete location"); }
    setDeleteId(null);
  };

  const { sort, handleSort, sortData } = useTableSort("name");

  const filtered = locations.filter(l => l.name.toLowerCase().includes(search.toLowerCase()));

  const sortedFiltered = sortData(filtered, (loc, key: string) => {
    const s = locationStats[loc.id] || { buildings: 0, units: 0, rooms: 0 };
    const map: Record<string, any> = { name: loc.name, buildings: s.buildings, units: s.units, rooms: s.rooms };
    return map[key];
  });

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  const isDirty = name !== initialName;

  return (
    <StandardPageLayout title="Locations" actionLabel="Add Location" actionIcon={<Plus className="h-4 w-4" />} onAction={openCreate}>
      {/* Add/Edit Modal */}
      <StandardModal
        open={showForm}
        onOpenChange={(open) => { if (!open) { setShowForm(false); setName(""); setEditingId(null); clearAllErrors(); } }}
        title={editingId ? "Edit Location" : "Add Location"}
        size="sm"
        isDirty={isDirty}
        footer={
          <Button onClick={handleSave} disabled={createLocation.isPending || updateLocation.isPending}>
            {createLocation.isPending || updateLocation.isPending ? "Saving..." : "Save"}
          </Button>
        }
      >
        <FormErrorBanner errors={errors} />
        <div data-field="name">
          <input className={fieldClass(`${inputClass} w-full`, !!errors.name)} placeholder="Location name (e.g. Bukit Jalil)" value={name} onChange={e => { setName(e.target.value); clearError("name"); }} autoFocus />
          <FieldError error={errors.name} />
        </div>
      </StandardModal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title="Delete Location?"
        description="Buildings linked to it will have their location cleared."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />

      <StandardFilterBar search={search} onSearchChange={setSearch} placeholder="Search locations..." />

      <StandardTable
        columns={
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <SortableTableHead sortKey="name" currentSort={sort} onSort={handleSort}>Location Name</SortableTableHead>
            <SortableTableHead sortKey="buildings" currentSort={sort} onSort={handleSort} className="text-center">Total Buildings</SortableTableHead>
            <SortableTableHead sortKey="units" currentSort={sort} onSort={handleSort} className="text-center">Total Units</SortableTableHead>
            <SortableTableHead sortKey="rooms" currentSort={sort} onSort={handleSort} className="text-center">Total Rooms</SortableTableHead>
            <TableHead className="w-32 text-right">Actions</TableHead>
          </TableRow>
        }
        isEmpty={sortedFiltered.length === 0}
        emptyMessage="No locations found"
        total={sortedFiltered.length}
      >
        {sortedFiltered.map((loc, i) => {
          const s = locationStats[loc.id] || { buildings: 0, units: 0, rooms: 0 };
          return (
            <TableRow key={loc.id}>
              <TableCell className="text-muted-foreground">{i + 1}</TableCell>
              <TableCell className="font-medium">{loc.name}</TableCell>
              <TableCell className="text-center font-semibold">{s.buildings}</TableCell>
              <TableCell className="text-center font-semibold">{s.units}</TableCell>
              <TableCell className="text-center font-semibold">{s.rooms}</TableCell>
              <TableCell className="text-right">
                <ActionButtons actions={[
                  { type: "edit", onClick: () => openEdit(loc) },
                  { type: "delete", onClick: () => setDeleteId(loc.id) },
                ]} />
              </TableCell>
            </TableRow>
          );
        })}
      </StandardTable>
    </StandardPageLayout>
  );
}
