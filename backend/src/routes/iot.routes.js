const express = require('express');
const router  = express.Router();
const { validateIoTPayload } = require('../middleware/validate');
const { receiveData }        = require('../controllers/iot.controller');

router.post('/data', validateIoTPayload, receiveData);

module.exports = router;
