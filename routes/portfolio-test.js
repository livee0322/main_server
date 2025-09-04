// List (공개/내 것)
router.get(
  '/',
  query('status').optional().isIn(['draft','published']),
  query('mine').optional().isIn(['1','true']),
  auth.optional ? auth.optional() : (req,res,next)=>next(),
  async (req, res) => {
    try{
      const page  = Math.max(parseInt(req.query.page || '1', 10), 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit || '20',10),1),50);

      const q = { type:'portfolio' };
      if (req.query.mine === '1' || req.query.mine === 'true') {
        if (!req.user) return res.status(401).json({ ok:false, message:'UNAUTHORIZED' });
        q.createdBy = req.user.id;
      } else {
        q.status = 'published';
        q.visibility = { $in:['public','unlisted'] };
      }
      if (req.query.status) q.status = req.query.status;

      const sort = { createdAt: -1 };
      const [docs, total] = await Promise.all([
        Portfolio.find(q).sort(sort).skip((page-1)*limit).limit(limit).lean(),
        Portfolio.countDocuments(q),
      ]);

      // ▶ 썸네일 필드 통일: mainThumbnailUrl를 항상 채워줌
      const items = docs.map(d => {
        const img =
          d.mainThumbnailUrl ||
          d.thumbnailUrl ||
          d.thumbnail ||
          (Array.isArray(d.images) && d.images[0]) ||
          (Array.isArray(d.subThumbnails) && d.subThumbnails[0]) ||
          d.coverImageUrl ||
          d.coverUrl ||
          d.imageUrl || '';

        return {
          ...d,
          mainThumbnailUrl: img,                         // 프론트에서 우선 사용
          thumbnailUrl: d.thumbnailUrl || img,          // 과거 필드도 유지
        };
      });

      return res.json({ items, page, limit, total, totalPages: Math.ceil(total/limit) });
    }catch(err){
      console.error('[portfolio-test:list]', err);
      return res.status(500).json({ ok:false, message: err.message || 'LIST_FAILED' });
    }
  }
);