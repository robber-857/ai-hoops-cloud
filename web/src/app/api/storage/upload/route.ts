import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const SIGNED_URL_EXPIRES_IN_SECONDS = 315360000;

function getRequiredEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY'): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }

  return value;
}

function validateStorageTarget(bucketName: string, objectKey: string): string | null {
  if (!/^[a-z0-9][a-z0-9._-]{1,62}$/.test(bucketName)) {
    return 'Invalid storage bucket name.';
  }

  if (!objectKey.startsWith('students/') || objectKey.includes('..')) {
    return 'Invalid upload object key.';
  }

  return null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }

  return String(error);
}

function isAlreadyUploadedError(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  return normalizedMessage.includes('already exists') || normalizedMessage.includes('duplicate');
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const bucketName = formData.get('bucketName');
    const objectKey = formData.get('objectKey');
    const contentType = formData.get('contentType');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing upload file.' }, { status: 400 });
    }

    if (typeof bucketName !== 'string' || typeof objectKey !== 'string') {
      return NextResponse.json({ error: 'Missing storage target.' }, { status: 400 });
    }

    const targetError = validateStorageTarget(bucketName, objectKey);
    if (targetError) {
      return NextResponse.json({ error: targetError }, { status: 400 });
    }

    const supabase = createClient(
      getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
      getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
      {
        auth: { persistSession: false },
      },
    );

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(objectKey, file, {
        contentType: typeof contentType === 'string' ? contentType : file.type,
      });

    if (uploadError && !isAlreadyUploadedError(uploadError.message)) {
      return NextResponse.json({ error: uploadError.message }, { status: 502 });
    }

    const { data: urlData, error: urlError } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(objectKey, SIGNED_URL_EXPIRES_IN_SECONDS);

    if (urlError || !urlData?.signedUrl) {
      return NextResponse.json(
        { error: urlError?.message || 'Supabase did not return a signed video URL.' },
        { status: 502 },
      );
    }

    return NextResponse.json({ signedUrl: urlData.signedUrl });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
