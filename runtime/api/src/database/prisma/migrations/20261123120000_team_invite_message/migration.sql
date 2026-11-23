-- 团队邀请留言。可空：旧邀请以及不填写留言的邀请都没有这段文字。
ALTER TABLE "TeamInvite" ADD COLUMN "message" TEXT;
