# -*- coding: utf-8 -*-
from odoo import fields, models


class PosConfig(models.Model):
    _inherit = 'pos.config'

    loyalty_id = fields.Many2many('loyalty.program', string='Loyalty Program', help='The loyalty program used by this point_of_sale')

