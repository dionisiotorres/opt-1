# -*- coding: utf-8 -*-

from odoo import api, models, fields, tools, _
from random import choice
from string import digits
from odoo.exceptions import ValidationError, UserError

class PosPromotion(models.Model):
    _inherit = 'pos.promotion'

    type = fields.Selection([
        ('1_discount_total_order', 'Discount on total order'),
        ('2_discount_category', 'Discount on categories'),
        ('3_discount_by_quantity_of_product', 'Discount by quantity of product'),
        ('4_pack_discount', 'Buy pack products discount products'),
        ('5_pack_free_gift', 'Buy pack products free products'),
        ('6_price_filter_quantity', 'Price product filter by quantity'),
        ('8_brand_product_pos', 'Discount by brands'),  # modified Values old=By Brand products free products
        ('9_product_product_pos', 'Buy products free products'),
        ('10_free_x_from_group_of_product', 'Free x from group of products'),# new added
    ], 'Type', required=1)
    #('11_flexible_buy_products_free_products', 'Flexible buy Products free Products')#new added

    # moved from pos_promotion start
    discount_type = fields.Selection([('percent', 'Percent'), ('amount', 'Amount')], string="Discount Type",
                                     default='percent')#modified product #, ('product', 'Product')
    #pos_pt_discount_amount_ids = fields.One2many('pos.product.discount.amount', 'promotion_id','Product Discount Amount')#newly added
    #pos_pt_discount_percent_ids = fields.One2many('pos.product.discount.percent', 'promotion_id','Product Discount Percent')# newly added

    brand_discount_ids = fields.One2many('pos.brand.discount.condition', 'promotion_id', 'Discount Condition')#discount by Brands
    # product_brand_ids = fields.Many2many('product.brand',
    #                                      string='Discount By Brand')  # new added for type=8_brand_product_pos
    #brand_free_ids = fields.One2many('pos.brand.product.free', 'promotion_id', 'Free Products')
    product_product_ids = fields.One2many('pos.product.product.condition', 'promotion_id', 'Product Condition')
    product_free_ids = fields.One2many('pos.product.product.free', 'promotion_id', 'Free Products')
    is_payment_mehod = fields.Boolean('Payment Method Limit')
    payment_method_id = fields.Many2many('account.journal', string="Payment Methods")
    # end
    # new added as per new doc for full_pos_promotion
    stackable_in_promotion = fields.Boolean('Stackable in Promotion')  # Newly added
    #total_price_filter_by_qty = fields.Boolean('Multiple in Total Price Filter by Qty')  # Newly added
    dm_free_gifts = fields.Boolean('Allow Double / Multiplied Free Gifts')  # Newly added
    group_of_products_ids = fields.One2many('pos.group.of.products', 'promotion_id',
                                            'Free x from group of products')  # Newly added for type=10_free_x_from_group_of_product
    #flexi_product_ids = fields.One2many('pos.flexi.products', 'promotion_id', string='Flexible buy Products free Products')#Newly added for type=11_flexible_buy_products_free_products
    # disc_by_percent = fields.Float('Discount %')
    #fl_pt_ids = fields.One2many('pos.flexi.list.products','promotion_id', string='List of Flexible Products')#For type=11
    qty_free = fields.Integer('Quantity Free', default=1)
    min_amt	= fields.Integer('Minimal Purchase Amount')
    otp_validation = fields.Boolean('OTP Validation')#For OTP generation
    max_disc_amt = fields.Integer('Maximum Discount Amount')
    prior_seq_no = fields.Integer('Priority Sequence Number')
    #brand_ids = fields.Many2many('product.brand', string='Brands')
    brand_id = fields.Many2one('product.brand', string='Brand')

    @api.multi
    @api.constrains('prior_seq_no')
    def _check_duplicate(self):
        for rec in self:
            promotion_ids = rec.search([('prior_seq_no', '=', rec.prior_seq_no)])
            if promotion_ids and len(promotion_ids) > 1:
                raise ValidationError(_('Enter Unique Sequence Number'))


'''for type = Flexible buy Products free Products
class PosFlexiProducts(models.Model):
    _name = "pos.flexi.products"
    _order = "product_id, minimum_quantity"

    product_id = fields.Many2one('product.product', domain=[('available_in_pos', '=', True)], string='Product',
                                 required=1)
    minimum_quantity = fields.Float('Qty greater or equal', required=1, default=1.0)
    promotion_id = fields.Many2one('pos.promotion', 'Promotion', required=1)


#for type = Flexible buy Products free Products
class PosFlexiListProducts(models.Model):
    _name = "pos.flexi.list.products"
    _order = "product_id"

    product_id = fields.Many2one('product.product', domain=[('available_in_pos', '=', True)], string='Product',
                                 required=1)
    promotion_id = fields.Many2one('pos.promotion', 'Promotion', required=1)'''

# For new added type = Free x from group of products
class PosGroupOfProducts(models.Model):
    _name = "pos.group.of.products"

    product_id = fields.Many2many('product.product', domain=[('available_in_pos', '=', True)], string='Group of Product')
    no_of_product = fields.Integer('Number of Products to Pay', default=1)
    to_pay = fields.Selection([
        ('cheapest', 'Cheapest'),
        ('most_expensive', 'Most Expensive'),
    ], 'To Pay')
    min_qty = fields.Float('Min Qty', default=1.0)
    min_amount = fields.Float('Min Amount', default=1.0)
    promotion_id = fields.Many2one('pos.promotion', 'Promotion', required=1)

#For Discount by amount
'''class PosProductDiscountAmount(models.Model):
    _name = "pos.product.discount.amount"
    _order = "product_id"

    product_id = fields.Many2one('product.product', domain=[('available_in_pos', '=', True)], string='Product Free',
                                 required=1)
    dic_amt = fields.Float('Discount Amount', required=1, default=1.0)
    promotion_id = fields.Many2one('pos.promotion', 'Promotion', required=1)'''


#For Discount by Percentage
'''class PosProductDiscountPercent(models.Model):
    _name = "pos.product.discount.percent"
    _order = "product_id"

    product_id = fields.Many2one('product.product', domain=[('available_in_pos', '=', True)], string='Product Free',
                                 required=1)
    dic_per = fields.Float('Discount %', required=1, default=1.0)
    promotion_id = fields.Many2one('pos.promotion', 'Promotion', required=1)'''

#For Discount by Brands
class PosBrandDiscountCondition(models.Model):
    _name = "pos.brand.discount.condition"
    _order = "brand_ids"

    brand_ids = fields.Many2many('product.brand', string='Brands', required=1)
    promotion_id = fields.Many2one('pos.promotion', 'Promotion', required=1)
    discount = fields.Float('Discount')

class pos_brand_product_free(models.Model):
    _name = "pos.brand.product.free"
    _order = "product_id"

    product_id = fields.Many2one('product.product', domain=[('available_in_pos', '=', True)], string='Product Free',
                                 required=1)
    quantity_free = fields.Float('Quantity free', required=1, default=1.0)
    promotion_id = fields.Many2one('pos.promotion', 'Promotion', required=1)


class pos_product_product_condition(models.Model):
    _name = "pos.product.product.condition"
    _order = "product_id, minimum_quantity"

    product_id = fields.Many2one('product.product', domain=[('available_in_pos', '=', True)], string='Product',
                                 required=1)
    minimum_quantity = fields.Float('Qty greater or equal', required=1, default=1.0)
    promotion_id = fields.Many2one('pos.promotion', 'Promotion', required=1)

#Buy products free products ->List of Free Product
class pos_product_product_free(models.Model):
    _name = "pos.product.product.free"
    _order = "product_id"

    product_id = fields.Many2one('product.product', domain=[('available_in_pos', '=', True)], string='Product Free',
                                 required=1)
    max_qty = fields.Float('Max Qty', required=1, default=1.0)#new added as per REQ 228
    promotion_id = fields.Many2one('pos.promotion', 'Promotion', required=1)

#overrided from core pos_promotion STRT
class pos_promotion_discount_order(models.Model):
    _inherit = "pos.promotion.discount.order"

    discount = fields.Float('Discount', required=1)

class pos_promotion_discount_category(models.Model):
    _inherit = "pos.promotion.discount.category"

    discount = fields.Float('Discount', required=1)

class pos_promotion_discount_quantity(models.Model):
    _inherit = "pos.promotion.discount.quantity"

    discount = fields.Float('Discount', required=1)

class pos_promotion_discount_apply(models.Model):
    _inherit = "pos.promotion.discount.apply"

    discount = fields.Float('Discount', required=1, default=1.0)


class CustomerOtpData(models.Model):
    _name = 'customer.otp.data'

    partner_id = fields.Many2one('res.partner', 'Customer')
    otp_result = fields.Char('OTP', copy=False)

    @api.multi
    def _default_random_opt(self):
        return "".join(choice(digits) for i in range(5))

    @api.model
    def send_mail_with_otp(self, partner):
        Mail = self.env['mail.mail']
        pos_partner_id = partner.get('id')
        if pos_partner_id:
            Res_partner_obj = self.env['res.partner'].search([('id','=',pos_partner_id)])
            if Res_partner_obj:
                vlas_create = {'partner_id': Res_partner_obj.id, 'otp_result': self._default_random_opt()}
                created_rec = self.create(vlas_create)
                if created_rec:
                    for partner in Res_partner_obj:
                        body_html = "Hi %s, <br/> Your POS PROMOTION OTP IS: %s<br/>Thank You." % (
                            partner.name,created_rec.otp_result)
                        mail_values = {
                            'subject': 'OTP OF POS Promotion',
                            'email_from': self.env.user.login,
                            'email_to': partner.email,
                            #'recipient_ids': user_id.partner_id,
                            'body_html': body_html,
                        }
                        mail_sent = Mail.create(mail_values).send()

        return True

    @api.model
    def check_otp(self, partner, partner_otp):
        res = False
        customer_otp_obj = self.search([('partner_id','=',partner.get('id'))], limit=1, order='id desc')
        if customer_otp_obj:
            if customer_otp_obj.otp_result == partner_otp:
                res = True
        return res


class ResBranch(models.Model):
    _inherit = 'res.branch'

    # pos_pin = fields.Char('POS Pin')
    approver_id = fields.Many2one('res.users', string='Promotion Approver')


class ResUsers(models.Model):
    _inherit = 'res.users'

    promotion_pin = fields.Char(string='Promotion PIN', size=32, help='A Security PIN used to protect sensible functionality in the Point of Sale')

    @api.constrains('promotion_pin')
    def _check_promotion_pin(self):
        if self.promotion_pin and not self.promotion_pin.isdigit():
            raise UserError(_("Promotion PIN can only contain digits"))

    @api.model
    def check_promotion_pin(self, current_user_id, user_pin):
        res = False
        if current_user_id and user_pin:
            user_obj = self.search([('id','=', current_user_id)])
            if user_obj:
                if user_obj.promotion_pin:
                    if user_obj.promotion_pin == user_pin:
                        res = True

        return res
