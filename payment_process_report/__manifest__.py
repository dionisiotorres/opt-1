# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
 'name': 'Payment Process Report',
    'version': '1.1',
    'author': 'GYB (Parth R Trivedi)',
    'website': 'www.gybitsolutions.com',
    'category': 'payment Process Report',
    'summary': '',
    #'website': 'https://www.odoo.com/page/crm',
    'depends': ['sales_team', 'account', 'sale', 'report'],
    'data': [
        'wizard/payment_process_wizard.xml',
        'report/payment_process_report_layout.xml',
        'report/payment_process_report_menu.xml',
        'report/payment_process_report_view.xml',
        'report/sale_report_templates.xml',
        
    ],
    'installable': True,
    'auto_install': False,
    'application': True,
}
