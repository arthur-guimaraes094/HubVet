-- Migration: Endurecimento das políticas RLS do bucket 'patients' em storage.objects
-- Garante que cada usuário autenticado só consiga inserir, atualizar ou excluir seus próprios arquivos.

DROP POLICY IF EXISTS "Authenticated users can upload patient photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload patient photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'patients'
    AND name LIKE ((SELECT auth.uid())::text || '-%')
  );

DROP POLICY IF EXISTS "Authenticated users can update patient photos" ON storage.objects;
CREATE POLICY "Authenticated users can update patient photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'patients'
    AND (
      owner = (SELECT auth.uid())
      OR name LIKE ((SELECT auth.uid())::text || '-%')
    )
  )
  WITH CHECK (
    bucket_id = 'patients'
    AND (
      owner = (SELECT auth.uid())
      OR name LIKE ((SELECT auth.uid())::text || '-%')
    )
  );

DROP POLICY IF EXISTS "Authenticated users can delete patient photos" ON storage.objects;
CREATE POLICY "Authenticated users can delete patient photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'patients'
    AND (
      owner = (SELECT auth.uid())
      OR name LIKE ((SELECT auth.uid())::text || '-%')
    )
  );
