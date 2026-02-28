/**
 * Validateurs centralisés réutilisables par toutes les routes API.
 *
 * Règle : ne jamais redéfinir validateCategoryAndTags dans une route.
 * Importer depuis ici.
 */
import { prisma } from '@/server/db/client';
import { BusinessReferenceType } from '@/generated/prisma';

// ---------------------------------------------------------------------------
// Category & Tags (BusinessReference)
// ---------------------------------------------------------------------------

type CategoryAndTagsResult =
  | { categoryId: bigint | null; tagIds: bigint[] }
  | { error: string };

/**
 * Valide qu'un categoryReferenceId (CATEGORY) et des tagReferenceIds (TAG)
 * existent pour le business donné et ne sont pas archivés.
 */
export async function validateCategoryAndTags(
  businessId: bigint,
  categoryReferenceId: bigint | null,
  tagReferenceIds?: bigint[]
): Promise<CategoryAndTagsResult> {
  if (categoryReferenceId) {
    const category = await prisma.businessReference.findFirst({
      where: {
        id: categoryReferenceId,
        businessId,
        type: BusinessReferenceType.CATEGORY,
        isArchived: false,
      },
      select: { id: true },
    });
    if (!category) return { error: 'categoryReferenceId invalide pour ce business.' };
  }

  let tagIds: bigint[] = [];
  if (tagReferenceIds && tagReferenceIds.length) {
    const tags = await prisma.businessReference.findMany({
      where: {
        id: { in: tagReferenceIds },
        businessId,
        type: BusinessReferenceType.TAG,
        isArchived: false,
      },
      select: { id: true },
    });
    if (tags.length !== tagReferenceIds.length) {
      return { error: 'tagReferenceIds invalides pour ce business.' };
    }
    tagIds = tags.map((t: { id: bigint }) => t.id);
  }

  return { categoryId: categoryReferenceId, tagIds };
}
