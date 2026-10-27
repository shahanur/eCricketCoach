-- Apply before deploying the binary-image API. Does not change external image URLs.
BEGIN;

CREATE TABLE IF NOT EXISTS public.drill_images (
    drill_id TEXT PRIMARY KEY REFERENCES public.drills(id) ON DELETE CASCADE,
    data BYTEA NOT NULL,
    mime_type TEXT NOT NULL
);

INSERT INTO public.drill_images (drill_id, data, mime_type)
SELECT
    id,
    decode(split_part(image_url, ',', 2), 'base64'),
    substring(image_url FROM '^data:(image/(?:png|jpeg));base64,')
FROM public.drills
WHERE image_url ~ '^data:image/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$'
ON CONFLICT (drill_id) DO NOTHING;

UPDATE public.drills AS drill
SET image_url = '/api/drills/' || drill.id || '/image'
WHERE drill.image_url ~ '^data:image/(png|jpeg);base64,'
    AND EXISTS (
        SELECT 1 FROM public.drill_images AS image
        WHERE image.drill_id = drill.id
    );

COMMIT;
