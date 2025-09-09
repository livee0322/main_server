'use strict';
const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const auth = require('../src/middleware/auth');
const requireRole = require('../src/middleware/requireRole');
const Application = require('../models/Application-test');

const badContact = /(email|@|카톡|카카오|kakao|톡|전화|phone|tel|연락|이메일)/i;

const base = [
  body('recruitId').isString().custom(v=>mongoose.isValidObjectId(v)),
  body('portfolioId').isString().custom(v=>mongoose.isValidObjectId(v)),
  body('message').optional().isString().isLength({ max:800 }).custom(v=>!badContact.test(v||'')),
];

function sendValidation(req,res,next){
  const v=validationResult(req);
  if(v.isEmpty()) return next();
  return res.status(422).json({ ok:false, code:'VALIDATION_FAILED', details:v.array({onlyFirstError:true}) });
}

/* 생성 */
router.post('/', auth, requireRole('showhost','admin'), base, sendValidation, async (req,res)=>{
  try{
    const payload = {
      recruitId: req.body.recruitId,
      portfolioId: req.body.portfolioId,
      message: req.body.message || '',
      createdBy: req.user.id,
    };
    const created = await Application.create(payload);
    return res.status(201).json({ ok:true, data: { id: created.id } });
  }catch(err){
    console.error('[applications-test:create]', err);
    return res.status(500).json({ ok:false, message: err.message || 'CREATE_FAILED' });
  }
});

module.exports = router;