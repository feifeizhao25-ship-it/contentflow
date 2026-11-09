-- 注册三问（行业、岗位、成长阶段）和省份。未填写保持空。
ALTER TABLE "User" ADD COLUMN "industry" TEXT;
ALTER TABLE "User" ADD COLUMN "job_role" TEXT;
ALTER TABLE "User" ADD COLUMN "growth_stage" TEXT;
ALTER TABLE "User" ADD COLUMN "province" TEXT;
