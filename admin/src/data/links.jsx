import React from 'react';
import { FiActivity, FiCreditCard, FiDollarSign, FiHome, FiGrid, FiPackage, FiUser, FiShield, FiSlash, FiServer, FiInbox, FiBarChart2, FiRefreshCw, FiTag, FiTool } from 'react-icons/fi';
// import { FiBox } from 'react-icons/fi';

export const links = [
  {
    title: 'Dashboard',
    links: [
      {
        name: 'home',
        icon: <FiHome />,
      },
      {
        name: 'API',
        icon: <FiServer />,
      },
      {
        name: 'requests',
        icon: <FiInbox />,
      },
      {
        name: 'payment',
        icon: <FiCreditCard />,
      },
      {
        name: 'transition',
        icon: <FiRefreshCw />,
      },
      {
        name: 'ads',
        icon: <FiBarChart2 />,
      },
      {
        name: 'finance-controls',
        icon: <FiDollarSign />,
      },
      {
        name: 'operational-logs',
        icon: <FiActivity />,
      },
    ],
  },
  {
    title: 'Users',
    links: [
      {
        name: 'customers',
        icon: <FiUser />,
      },
      {
        name: 'agents',
        icon: <FiShield />,
      },
      {
        name: 'blacklist',
        icon: <FiSlash />,
      },
      {
        name: 'admins',
        icon: <FiShield />,
      },
      {
        name: 'customer-categories',
        icon: <FiTag />,
      },
      {
        name: 'agent-operations',
        icon: <FiTool />,
      },
    ],
  },
  {
    title: 'Store',
    links: [
      {
        name: 'sections',
        icon: <FiGrid />,
      },
      {
        name: 'products',
        icon: <FiPackage />,
      },
      // {
      //   name: 'packages',
      //   icon: <FiBox />,
      // },
    ],
  },
];
