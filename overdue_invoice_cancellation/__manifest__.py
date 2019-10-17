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

{
    'name': 'Overdue Invoice Cancellation',
    'version': '1.0',
    'author': 'GYB (Parth R Trivedi)',
    'website': 'www.gybitsolutions.com',
    'category': 'sale',
    'summary': 'fill days add in today date then math of SO end date if SO end date cross then related record is del and if date is not cross then sed customer mail your payment is pending of this invoice ',
    'depends': ['sale','account','account_cancel'],
    'data': [
        'views/invoice_cancellation.xml',
        
    ],
    'demo': [
    'data/overdue_invoice_cancellation_days.xml',
    ],

    'installable': True,
    'application': True,
    'auto_install': False,
}
# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
