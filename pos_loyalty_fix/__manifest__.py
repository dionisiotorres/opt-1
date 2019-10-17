# -*- coding: utf-8 -*-
{
    'name': 'POS Loyalty Fix',
    'version': '10.0.3',
    'category': 'POS',
    'author': 'Hashmicro-Bhautik/Pranjal',
    'website': 'http://www.hashmicro.com/',
    'description': """ """,
    'depends': ['base','pos_loyalty', 'point_of_sale', 'product'],
    'data': [
        'security/ir.model.access.csv',
        'data/point_expire_data.xml',
        'data/upgrade_loyalty_prog_scheduler.xml',
        'data/downgrade_loyalty_prog_scheduler.xml',
        'views/assets.xml',
        'views/res_partner_views.xml',
        'views/loyalty_program_views.xml',
        'views/reward_history_views.xml',
        'views/pos_config_views.xml',
        'report/pos_order_report_view.xml'
    ],
    'qweb': ['static/src/xml/pos_loyalty_fix.xml'],
    'demo': [
    ],
    'installable': True,
    'auto_install': False,
}
