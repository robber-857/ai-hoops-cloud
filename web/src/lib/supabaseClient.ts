import { createClient } from '@supabase/supabase-js';

// 读取环境变量
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 创建并导出客户端
export const supabase = createClient(supabaseUrl, supabaseKey);