-- ============================================
-- HOTFIX: إنشاء دالة مراجعة طلبات الإلغاء الناقصة
-- السبب: خطأ "Could not find the function public.admin_review_cancel_request in the schema cache"
-- التنفيذ: الصق هذا الملف كاملاً في Supabase → SQL Editor → Run (مرة واحدة فقط)
-- ============================================

create or replace function public.admin_review_cancel_request(
  p_request_id uuid,
  p_approve boolean,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare r public.order_cancel_requests%rowtype;
begin
  if not public.is_admin() then raise exception 'غير مصرح'; end if;
  select * into r from public.order_cancel_requests where id=p_request_id for update;
  if not found then raise exception 'الطلب غير موجود'; end if;
  if r.status<>'pending' then raise exception 'تمت معالجة الطلب سابقاً'; end if;

  if p_approve then
    perform public.admin_process_order(r.order_id,'cancelled',null,coalesce(p_reason,'قبول طلب الإلغاء'));
    update public.order_cancel_requests set status='approved',reviewed_by=auth.uid(),reviewed_at=now() where id=r.id;
  else
    update public.order_cancel_requests set status='rejected',reviewed_by=auth.uid(),reviewed_at=now() where id=r.id;
    insert into public.notifications(user_id,title,body,type)
    values(r.user_id,'تم رفض طلب الإلغاء',coalesce(p_reason,'تم رفض طلب الإلغاء'),'order');
  end if;
  return jsonb_build_object('success',true);
end$$;

grant execute on function public.admin_review_cancel_request(uuid,boolean,text) to authenticated;

-- إجبار PostgREST على إعادة تحميل ذاكرة الـ schema فوراً
notify pgrst, 'reload schema';
