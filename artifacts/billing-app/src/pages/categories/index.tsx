import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api-client";
import {
  Layers,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  FolderTree,
  Sparkles,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export default function CategoriesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formOrder, setFormOrder] = useState<number>(0);

  // Fetch categories
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await api.get("/api/categories");
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post("/api/categories", payload);
      return res.data;
    },
    onSuccess: () => {
      toast({ title: "Category Created", description: "New category added successfully." });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast({
        title: "Creation Failed",
        description: err.response?.data?.error || "Failed to create category",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const res = await api.patch(`/api/categories/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      toast({ title: "Category Updated", description: "Changes saved successfully." });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setEditingCategory(null);
      resetForm();
    },
    onError: (err: any) => {
      toast({
        title: "Update Failed",
        description: err.response?.data?.error || "Failed to update category",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/categories/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Category Deleted" });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (err: any) => {
      toast({
        title: "Delete Failed",
        description: err.response?.data?.error || "Failed to delete category",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormName("");
    setFormSlug("");
    setFormDescription("");
    setFormOrder(0);
  };

  const handleNameChange = (name: string) => {
    setFormName(name);
    if (!editingCategory) {
      setFormSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    }
  };

  const handleOpenEdit = (cat: any) => {
    setEditingCategory(cat);
    setFormName(cat.name);
    setFormSlug(cat.slug);
    setFormDescription(cat.description || "");
    setFormOrder(cat.displayOrder || 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formSlug.trim()) {
      toast({ title: "Name and Slug are required", variant: "destructive" });
      return;
    }
    const payload = {
      name: formName.trim(),
      slug: formSlug.trim(),
      description: formDescription.trim(),
      displayOrder: Number(formOrder) || 0,
    };
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filteredCategories = categories.filter((c: any) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <FolderTree className="w-5 h-5" />
              </span>
              <h1 className="font-serif text-2xl font-bold tracking-tight">
                Category Management
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Organize your jewellery catalog into dynamic categories and subcategories.
            </p>
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => { resetForm(); setEditingCategory(null); }}
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Add Category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-serif text-lg">Create New Category</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Category Name</label>
                  <Input
                    placeholder="e.g. Necklace Sets, Chokers, Rings"
                    value={formName}
                    onChange={(e) => handleNameChange(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">URL Slug</label>
                  <Input
                    placeholder="e.g. necklace-sets"
                    value={formSlug}
                    onChange={(e) => setFormSlug(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Description</label>
                  <Input
                    placeholder="Short description for customer catalogue"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Display Priority (Order)</label>
                  <Input
                    type="number"
                    value={formOrder}
                    onChange={(e) => setFormOrder(Number(e.target.value) || 0)}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} className="bg-amber-600 hover:bg-amber-700 text-white font-semibold">
                    {createMutation.isPending ? "Saving..." : "Create Category"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            {categories.length} Categories Configured
          </span>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCategories.map((cat: any) => (
            <Card key={cat.id} className="border-border hover:border-amber-300 transition-all shadow-xs flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <CardTitle className="font-serif text-base font-bold">
                        {cat.name}
                      </CardTitle>
                      <CardDescription className="text-xs font-mono">
                        /{cat.slug}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-amber-100/70 text-amber-900 font-medium text-[11px]">
                    {cat.productCount} Items
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {cat.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-4 font-light">
                    {cat.description}
                  </p>
                )}
                <div className="flex items-center justify-between border-t border-border/60 pt-3">
                  <span className="text-[11px] text-muted-foreground">
                    Priority: #{cat.displayOrder}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEdit(cat)}
                      className="h-7 px-2 text-neutral-600 hover:text-amber-700"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Delete category "${cat.name}"?`)) {
                          deleteMutation.mutate(cat.id);
                        }
                      }}
                      className="h-7 px-2 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Edit Dialog */}
        {editingCategory && (
          <Dialog open={Boolean(editingCategory)} onOpenChange={(open) => { if (!open) setEditingCategory(null); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-serif text-lg">Edit Category</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Category Name</label>
                  <Input
                    value={formName}
                    onChange={(e) => handleNameChange(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">URL Slug</label>
                  <Input
                    value={formSlug}
                    onChange={(e) => setFormSlug(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Description</label>
                  <Input
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Display Priority (Order)</label>
                  <Input
                    type="number"
                    value={formOrder}
                    onChange={(e) => setFormOrder(Number(e.target.value) || 0)}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setEditingCategory(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateMutation.isPending} className="bg-amber-600 hover:bg-amber-700 text-white font-semibold">
                    {updateMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
  );
}
