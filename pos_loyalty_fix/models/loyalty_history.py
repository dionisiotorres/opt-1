# -*- coding: utf-8 -*-
from odoo import api, fields, models


class LoyaltyProgram(models.Model):
    _inherit = 'loyalty.program'

    history_ids = fields.One2many("loyalty.history", 'loyalty_id')
    pos_mem_type_id = fields.Many2one('pos.mem.type', "Membership Type")
    period = fields.Integer("Period In Days.")
    min_trans = fields.Float('Minimal Transaction')#added by gyb
    min_points = fields.Float('Minimum Points')#added by gyb

    ic_join = fields.Boolean('Incur Cost when Joining')#added by gyb
    ic_join_product_id = fields.Many2one('product.product', string='Product for Joining')#added by gyb
    ic_join_cost = fields.Float(string='Cost')#added by gyb

    ic_upg = fields.Boolean('Incur Cost when Upgrading')#added by gyb
    ic_upg_product_id = fields.Many2one('product.product', string='Product for Upgrading')#added by gyb
    ic_upg_cost = fields.Float(string='Cost')#added by gyb

    auto_up = fields.Boolean('Auto Upgrade')#added by gyb
    auto_up_minimum_points = fields.Float(string='Minimum Points')#added by gyb
    auto_up_loyalty_id = fields.Many2one("loyalty.program", "Upgrade to")#added by gyb

    auto_down = fields.Boolean('Auto Downgrade')#added by gyb
    auto_down_minimum_points = fields.Float(string='Minimum Points')#added by gyb
    auto_down_loyalty_id = fields.Many2one("loyalty.program", "Downgrade to")#added by gyb
        
    #Added by GYB
    @api.multi
    def _check_loyalty_program_upgrade(self):   #upgrade_loyalty_prog_scheduler schedular method
        loyalty_program_ids = self.env['loyalty.program'].search([])
        for loyalty_program_id in loyalty_program_ids:
            if loyalty_program_id.auto_up == True and loyalty_program_id.auto_up_loyalty_id:
                res_partner_ids = self.env['res.partner'].search([('loyalty_id','=',loyalty_program_id.id)])
                for res_partner in res_partner_ids:
                    if res_partner.active_points > 0 and res_partner.active_points >= loyalty_program_id.auto_up_minimum_points:
                        res_partner.loyalty_id = loyalty_program_id.auto_up_loyalty_id.id
        return True
    
    @api.multi
    def _check_loyalty_program_downgrade(self): #downgrade_loyalty_prog_scheduler schedular method
        loyalty_program_ids = self.env['loyalty.program'].search([])
        for loyalty_program_id in loyalty_program_ids:
            if loyalty_program_id.auto_down == True and loyalty_program_id.auto_down_loyalty_id:
                res_partner_ids = self.env['res.partner'].search([('loyalty_id','=',loyalty_program_id.id)])
                for res_partner in res_partner_ids:
                    if res_partner.active_points > 0 and res_partner.active_points < loyalty_program_id.auto_down_minimum_points:
                        res_partner.loyalty_id = loyalty_program_id.auto_down_loyalty_id.id
        return True
    
    #Added by GYB-Done

class LoyaltyHistory(models.Model):
    _name = 'loyalty.history'
    _rec_name = "partner_id"

    partner_id = fields.Many2one('res.partner', "Partner")
    loyalty_id = fields.Many2one('loyalty.program', "Loyalty")
    mem_no = fields.Char("Membership No.")
    # mem_name = fields.Char("Membership Name")
    mem_join_date = fields.Date("Join Date")
    mem_exp_date = fields.Date("Expiry Date")
    loyalty_points = fields.Float("Loyalty Points")