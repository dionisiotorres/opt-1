# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json
import base64
import odoo
from odoo import http
from odoo.http import request


class pos_loyalty_fix(http.Controller):    
    
    #Added by GYB
    @http.route(['/get_loyalty_product'], type='json', auth="public")
    def get_loyalty_product(self, lp_pro_id=None, **kwargs):
        values = {}
        loyalty_program_id = request.env['loyalty.program'].browse(int(lp_pro_id))
        values.update({
            'loyalty_program_id': loyalty_program_id.id,
            'ic_join_product_id': loyalty_program_id.ic_join_product_id.id,
            'ic_join_cost' :  loyalty_program_id.ic_join_cost,
        })
        return values

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: