-- Migration to add email column to profiles for easier management
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Update existing profiles with emails from auth.users (requires service_role/admin context to run, 
-- but this migration file serves as a template/trackable change)
-- UPDATE public.profiles p SET email = u.email FROM auth.users u WHERE p.id = u.id;

-- Update the sync trigger to include email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, role, email)
    VALUES (
        new.id, 
        COALESCE(new.raw_user_meta_data->>'full_name', 'Novo Usuário'), 
        COALESCE(new.raw_user_meta_data->>'role', 'TECNICO'),
        new.email
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
