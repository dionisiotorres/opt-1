# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from datetime import date


class ResPartner(models.Model):
    _inherit = 'res.partner'

    mem_no = fields.Char("Membership No.")
    # mem_name = fields.Char("Membership Name")
    mem_join_date = fields.Date("Membership Join Date")
    mem_exp_date = fields.Date("Membership Exp. Date", compute="_compute_exp_date", store=True)
    mem_type = fields.Many2one("pos.mem.type", "Membership Type")
    reward_history_id = fields.One2many('reward.history', 'partner_id', "Reward History")
    reward_applicable = fields.Boolean("Loyalty Apllicable?")
    loyalty_id = fields.Many2one("loyalty.program", "Loyalty")
    active_points = fields.Float("Active Points", compute='_compute_total_loyalty_points')
    loyalty_points = fields.Float(string="Loyalty Points", help='The loyalty points the user won as part of a Loyalty Program',related="active_points")
    po_loyalty_count = fields.Integer(
        compute='_compute_pos_order_loyalty',
        help="The number of point of sale orders with have loyalty points related to this customer",
    )

    @api.multi
    def _compute_pos_order_loyalty(self):
        '''rewards_history = self.reward_history_id
        count = 0
        for reward in rewards_history:
            count +=1
        self.po_loyalty_count = count
        '''
        for partner in self:
            pos_order_obj = self.env['pos.order'].search([('partner_id','=',partner.id)])
            count = 0
            for order in pos_order_obj:
                for line in order.lines:
                    count +=1
            partner.po_loyalty_count = count

    @api.multi
    def open_pos_order_for_loyalty(self):
        '''
        action = self.env.ref('point_of_sale.action_pos_pos_form').read()[0]
        rewards_history = self.reward_history_id
        pos_ids = []
        for reward in rewards_history:
            pos_ids.append(reward.pos_order_id.id)
        action['domain'] = [('id', 'in', pos_ids)]
        return action
        '''
        action = self.env.ref('point_of_sale.action_pos_order_line').read()[0]
        for partner in self:
            pos_order_obj = self.env['pos.order'].search([('partner_id','=',partner.id)])
            pos_order_line_ids = []
            for order in pos_order_obj:
                for line in order.lines:
                    pos_order_line_ids.append(line.id)
            action['domain'] = [('id', 'in', pos_order_line_ids)]
            return action

    @api.depends('reward_history_id.points_left')
    def _compute_total_loyalty_points(self):
        for record in self:
            active_total = 0
            today = datetime.today()
            for line in record.reward_history_id:
                if line.expiry_date:
                    expiry_date = line.expiry_date
                    if expiry_date > str(today):
                        if line.points_left:
                            active_total += line.points_left
            record.active_points = active_total


    @api.depends('mem_join_date', 'loyalty_id')
    def _compute_exp_date(self):
        for partner in self:
            if partner.mem_join_date and partner.loyalty_id:
                partner.mem_exp_date = (datetime.strptime(self.mem_join_date,'%Y-%m-%d') + relativedelta(days=partner.loyalty_id.period)).strftime('%Y-%m-%d')
            else:
                partner.mem_exp_date = False

    @api.model
    def create_from_ui(self, partner):
        if partner.get('reward_applicable'):
            partner.update({'reward_applicable': True})
        else:
            partner.update({'reward_applicable': False})
        res = super(ResPartner, self).create_from_ui(partner)
        return res

    @api.multi
    def point_expire_server_action(self):
        today_date = datetime.today()        
        reward_history = self.env['reward.history'].search([('expiry_date','<=',str(today_date))])
        for reward in reward_history:
            reward.points_expired = reward.points_left
            reward.points_left = 0



class PosMemType(models.Model):
    _name = 'pos.mem.type'

    name = fields.Char("Name")
    period = fields.Integer("Period In Days.")


class RewardHistory(models.Model):
    _name = 'reward.history'
    _order = 'date_order desc'
    _rec_name = "pos_order_id"

    def _default_expiry_date(self):
        today = datetime.today()
        after_year = today + relativedelta(years=1)
        return after_year

    partner_id = fields.Many2one("res.partner", "Customer")
    pos_order_id = fields.Many2one("pos.order", "POS Order")
    amount = fields.Float("Order Amount")
    loyalty_points = fields.Float("Loyalty Points")
    date_order = fields.Datetime("Date")
    loyalty_id = fields.Many2one('loyalty.program', "Loyalty")
    points_earned = fields.Float("Points earned")
    points_used = fields.Float("Points used")
    points_expired = fields.Float("Points Expired")
    points_left = fields.Float("Points left")
    expiry_date = fields.Datetime("Expiry Date",default=_default_expiry_date)

    @api.model
    def search(self, args, offset=0, limit=None, order=None, count=False):
        context = self._context or {}
        if context.get('filter_point_left') == None:
            args += [('points_left','>', 0.0)]
        else:
            args += []
            return super(RewardHistory, self).search(args, offset, limit, order, count=count)
        return super(RewardHistory, self).search(args, offset, limit, order, count=count)
