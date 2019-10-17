# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from datetime import datetime, timedelta
from odoo.exceptions import Warning,ValidationError, RedirectWarning
from datetime import date
import json

import logging
_logger = logging.getLogger(__name__)


class PosOrder(models.Model):
    _inherit = 'pos.order'

    loyalty_id = fields.Many2one("loyalty.program", "Loyalty")
    st_loyalty_pts = fields.Float("Starting Loyalty Point", compute='_get_st_loyalty')
    end_loyalty_pts = fields.Float("Ending Loyalty Point", compute='_get_last_loyalty')
    pt_earned = fields.Float("Points Earned")
    pt_used = fields.Float("Points Used")

    @api.model
    def _order_fields(self, ui_order):
        fields = super(PosOrder, self)._order_fields(ui_order)
        fields['loyalty_id'] = ui_order.get('loyalty_id')
        return fields

    @api.multi
    def _get_st_loyalty(self):
        for rec in self:
            if rec.partner_id:
                reward_history_obj = self.env['reward.history'].search(
                    [('partner_id', '=', rec.partner_id.id)])
                pt_left = []
                for reward in reward_history_obj:
                    pt_left.append(reward.points_left)
                if pt_left:
                    rec.st_loyalty_pts = pt_left[0]

    @api.multi
    def _get_last_loyalty(self):
        for rec in self:
            if rec.partner_id:
                reward_history_obj = self.env['reward.history'].search(
                    [('partner_id', '=', rec.partner_id.id)])
                pt_left = []
                for reward in reward_history_obj:
                    pt_left.append(reward.points_left)
                if pt_left:
                    rec.end_loyalty_pts = pt_left[-1]


    @api.model
    def create_from_ui(self, orders):
        order_ids = super(PosOrder, self).create_from_ui(orders)
        for order in orders:
            if order['data']['loyalty_points'] != 0 and order['data']['partner_id']:
                session = self.env['pos.session'].sudo().browse(order['data']['pos_session_id'])
                if session.config_id and session.config_id.loyalty_id:
                    partner = self.env['res.partner'].sudo().browse(order['data']['partner_id'])
                    history = self.env['loyalty.history'].search([
                        ('partner_id', '=', partner.id),
                        # ('loyalty_id', '=', order.loyalty_id.id)
                    ])
                    if not history:
                        self.env['loyalty.history'].create({
                            'partner_id': partner.id,
                            # 'loyalty_id': session.loyalty_id.id,
                            # 'mem_no': partner.mem_no,
                            # 'mem_name': partner.mem_name,
                            'mem_join_date': partner.mem_join_date,
                            'mem_exp_date': partner.mem_exp_date,
                            'loyalty_points': partner.loyalty_points,
                            # 'loyalty_id': order.loyalty_id.id,
                        })
                    else:
                        history.write({
                            # 'mem_no': partner.mem_no,
                            # 'mem_name': partner.mem_name,
                            'mem_join_date': partner.mem_join_date,
                            'mem_exp_date': partner.mem_exp_date,
                            'loyalty_points': partner.loyalty_points,
                        })

                    # create reward history
                    order_id = self.env['pos.order'].search([('pos_reference','=',order['data'].get('name'))])
                    today = datetime.today()
                    use = order['data'].get('points_spent')
                    use_amount = 0
                    if use <= partner.active_points:
                        reward_ids = self.env['reward.history'].search([('expiry_date','>=',str(today)),('partner_id','=',partner.id)],order='expiry_date')
                        if reward_ids:
                            for r in reward_ids:
                                if use > 0:
                                    if use >= r.points_left:
                                        use = use - r.points_left
                                        r.points_left = 0
                                    else:
                                        if r.points_left < use:
                                            use_amount = use
                                            use = use - r.points_left
                                            if use > 0:
                                                r.points_left = 0     
                                                r.points_used += use_amount
                                                break
                                        if r.points_left > use:
                                            use_amount = use
                                            use = r.points_left - use 
                                            if use > 0:
                                                r.points_left = use
                                                r.points_used += use_amount
                                                break

                        self.env['reward.history'].create({
                            'partner_id': partner.id,
                            'pos_order_id': order_id.id,
                            'amount':order_id.amount_total,
                            'date_order': order_id.date_order,
                            # 'loyalty_points': order_id.loyalty_points,
                            'points_earned': order['data'].get('points_won'),
                            'points_used': 0,
                            'points_left': order['data'].get('points_won'),
                            'loyalty_id': order['data'].get('loyalty_id'),
                        })
                        if order['data'].get('points_won'):
                            order_id.update({'pt_earned':order['data'].get('points_won'),'pt_used': 0})

            #Added by GYB
            if 'loyalty_id' in order['data']:
                if 'partner_id' in order['data']:
                    partner = self.env['res.partner'].browse(order['data']['partner_id'])
                    if partner:
                        partner.loyalty_id = order['data']['loyalty_id']
                        partner.mem_join_date = datetime.now()
                        partner.reward_applicable = True
            #Added by GYB-Done
        return order_ids
