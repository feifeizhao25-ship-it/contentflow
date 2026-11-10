-- 注册三问（行业、岗位、成长阶段）和省份。可空：没填过的账号保持空，不参与推荐排序。
ALTER TABLE "User" ADD COLUMN "industry" TEXT;
ALTER TABLE "User" ADD COLUMN "job_role" TEXT;
ALTER TABLE "User" ADD COLUMN "growth_stage" TEXT;
ALTER TABLE "User" ADD COLUMN "province" TEXT;
