// ============================================================
// Bir loyallıq proqramının VERİLMİŞ filial üçün aktiv olub-olmadığını
// yoxlayan ORTAQ funksiya (həm App, həm POS eyni faylı istifadə edir).
//
// `branchId`: null = Əsas filial, UUID = konkret filial.
// ============================================================

export function programAppliesToBranch(program, branchId) {
  if (program.applies_to_all_branches) return true;
  if (branchId === null || branchId === undefined) {
    return !!program.includes_main_branch;
  }
  return Array.isArray(program.branch_ids) && program.branch_ids.includes(branchId);
}

// Proqramın hansı filiallarda aktiv olduğunu qısa, oxunaqlı mətnlə
// göstərir (ekranlarda "🏢 ..." kimi istifadə üçün):
export function describeProgramBranches(program, branches, businessName) {
  if (program.applies_to_all_branches) return 'Bütün filiallar';
  const parts = [];
  if (program.includes_main_branch) parts.push(`${businessName || 'Biznes'} (Əsas)`);
  (program.branch_ids || []).forEach((id) => {
    const b = branches.find((x) => x.id === id);
    if (b) parts.push(b.name);
  });
  return parts.length ? parts.join(', ') : 'Heç bir filial seçilməyib';
}