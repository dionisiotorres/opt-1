# -*- coding: utf-8 -*-
##############################################################################
#
#    OpenERP, Open Source Management Solution
#    Copyright (C) 2004-2010 Tiny SPRL (<http://tiny.be>).
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU Affero General Public License as
#    published by the Free Software Foundation, either version 3 of the
#    License, or (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU Affero General Public License for more details.
#
#    You should have received a copy of the GNU Affero General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.
#
##############################################################################

from datetime import datetime, timedelta
import time
from datetime import date
from odoo import api, fields, models, _
from odoo.tools.translate import _
from odoo.tools import DEFAULT_SERVER_DATE_FORMAT, DEFAULT_SERVER_DATETIME_FORMAT
import odoo.addons.decimal_precision as dp
#from openerp import workflow

class student_detail(models.Model):
    _name = "student.detail"
    #_inherit = "res.partner"

    #company_id = fields.Many2one('res.company', string='Company', required=True)
    #sale_note = fields.Text(related='company_id.sale_note', string="Default Terms and Conditions *")
    img = fields.Binary(attachment=True)
    name = fields.Many2one('res.partner', String='Name', required=True, domain="[('student','=',True)]")
    address_id = fields.Many2one ('res.partner', string='Address')
    gender = fields.Selection([('m','Male'),('f','Female')], string='Gender')
    dob = fields.Date('Date of Birth')
    active = fields.Boolean('Active')
    student = fields.Boolean('Student')
    staff = fields.Boolean('Staff')
    #this is call a Related field which data value is not a store in table it's Temporary
    customer = fields.Boolean(related='name.customer', string="It's also customer")
    register = fields.Datetime(string='Register Date', required=True, readonly=True, default=fields.Datetime.now)
    note = fields.Text('Note')
    student_ids = fields.One2many('book.issue.detail','student_id','Book Issue', copy=True)
    book_ids = fields.One2many('book.detail','student_id','Book Detail')

    @api.multi
    @api.onchange('name')
    def onchange_name(self):
        print self.name
        print "hiiiiiiii",self.name.dob,"\n\n\n"
        self.dob = self.name.dob
        '''if self.name.dob:
            self.update({
                'dob': self.name.dob,
                   })
            return'''


class student_res_partner(models.Model):
    _inherit = "res.partner"
    sudent_ids = fields.One2many('student.detail','address_id','Address of Student')
    student = fields.Boolean('Is a Student')
    dob = fields.Date('Date of Birth')


class book_detail(models.Model):
    _name = "book.detail"
    name = fields.Char('Name', size=30, required=True, help="Name of Book")
    author = fields.Char('Author Name', size=35, required=True)
    price = fields.Integer('Price', size=4)
    student_id = fields.Many2one('student.detail', string='Student')
    book_ids = fields.One2many('book.issue.detail', 'book_id', string='Book Issue')
    partner_ids = fields.Many2many('student.detail', 'student_detail_rel', 'book_ids', 'name', string='Book Issue')
    # understand to many2many
    '''

    'note_ids': fields.many2many(
                                'notebook',
                                'name',
                                'title',
                                string="Notebooks"
                                        ),'''

class book_issue_detail(models.Model):
    _name = "book.issue.detail"
    _rec_name = 'book_id'
    #_inherit = "res.partner"
    student_id = fields.Many2one('student.detail','Member', required=True)
    book_id = fields.Many2one('book.detail','Book Name', required=True)
    issue_date = fields.Datetime('Issue Date')
    status = fields.Selection([('return','Return'),('issue','Issue')],String='Book Status')
    history_id = fields.Many2one('book.history','History',readonly=True)


class book_return_detail(models.Model):
    _name = "book.return.detail"
    book_id = fields.Many2one('book.issue.detail',string='Book Name', required=True)
    name = fields.Char('Name')
    issue_date = fields.Datetime(string='Issue Date')
    return_date = fields.Datetime(string='Return Date',default=fields.Datetime.now)
    days = fields.Integer('Days',readonly = True)
    #charge = fields.Integer(string='Charge',store=True, readonly=True, compute='_count_charge')
    charge = fields.Integer(string='Charge',readonly=True)

    '''
    @api.one
    @api.depends('issue_date')
    def _count_charge(self):
        print self.issue_date
        rtn_date = datetime.strptime(self.return_date,'%Y-%m-%d')
        issu_date = datetime.strptime(self.issue_date,'%Y-%m-%d')
        delta=relativedelta (rtn_date, issu_date)
        print delta,"delllltaaaaa"
        #print self.d0
    '''

    @api.multi
    @api.onchange('book_id')
    def onchange_name(self):
        std_obj = self.book_id.student_id
        print std_obj
        print std_obj.name
        self.name = std_obj.name.name
        self.issue_date = self.book_id.issue_date


        '''
        addr = self.partner_id.address_get(['delivery', 'invoice'])
        values = {
            'pricelist_id': self.partner_id.property_product_pricelist and self.partner_id.property_product_pricelist.id or False,
            'payment_term_id': self.partner_id.property_payment_term_id and self.partner_id.property_payment_term_id.id or False,
            'partner_invoice_id': addr['invoice'],
            'partner_shipping_id': addr['delivery'],
        }'''

class book_history(models.Model):
    _name = "book.history"
    _description = "Book History Information"
    _rec_name = 'name'
    name = fields.Char('Name')
    book_id = fields.Char('Book',required=True, copy=False)
    student_id = fields.Char('Student',required=True, copy=False)

    state = fields.Selection([('issue', 'issued'),
                                   ('return','Returned'),],
                                   'Status', required=True)

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
