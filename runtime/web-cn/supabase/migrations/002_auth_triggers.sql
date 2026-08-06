-- triggers for automatic tenant and profile creation

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_tenant_id UUID;
BEGIN
  -- 1. Create a new tenant for the user
  INSERT INTO public.tenants (name, plan)
  VALUES (
    COALESCE(new.raw_user_meta_data->>'tenant_name', '我的团队'),
    COALESCE(new.raw_user_meta_data->>'plan', 'free')
  )
  RETURNING id INTO new_tenant_id;

  -- 2. Create the user profile
  INSERT INTO public.profiles (id, tenant_id, email, name, role)
  VALUES (
    new.id,
    new_tenant_id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', new.email),
    'owner'
  );

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
