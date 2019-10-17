# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
	'name' : 'Sale Purchase XLS Report',
	'version' : '1.0',
	'category': 'purchase',
	'author': 'GYB IT Solutions',
	#'description': """ Xls report for Sale,Purchase Quotation and Order.	""",
	'website': 'http://www.gybitsolutions.com/',
	'depends' : [
		'sale','purchase','account', 'stock',
	],
	'data': [
		
	    'wizard/export_csv_report_purchase.xml',
	    'wizard/export_csv_report_sale.xml',
	    'wizard/export_csv_report_account.xml',
	    'wizard/export_csv_report_stock.xml',
	],
	'demo': [
	],
	'installable': True,
	'application': True,
	'auto_install': False,
}

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:        
