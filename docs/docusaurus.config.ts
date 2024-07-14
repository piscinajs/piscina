import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import tabBlocks from 'docusaurus-remark-plugin-tab-blocks';

const config: Config = {
  title: 'Piscina',
  tagline: 'The node.js worker pool',
  favicon: 'img/favicon.ico',

  // Set the production url of your site here
  url: 'https://your-docusaurus-site.example.com',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'Piscina', // Usually your GitHub org/user name.
  projectName: 'piscina.js', // Usually your repo name.

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en']
  },

  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
          remarkPlugins: [
            [
              tabBlocks,
              {
                labels: [
                  ['json', 'JSON'],
                  ['jsx', 'JSX'],
                  ['tsx', 'TSX']
                ]
              }
            ]
          ]
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css'
        },
        pages: {
          remarkPlugins: [tabBlocks]
        }
      }
    ]
  ],

  themes: [
    [
      require.resolve('@easyops-cn/docusaurus-search-local'),
      {
        hashed: true,
        docsRouteBasePath: '/',
        searchBarPosition: 'right'
      }
    ]
  ],
  themeConfig: {
    // Replace with your project's social card
    image: 'img/docusaurus-social-card.jpg',
    navbar: {
      title: 'Piscina',
      logo: {
        alt: 'My Site Logo',
        src: 'img/logo.png'
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Documentation'
        },
        // {
        //   type: 'search',
        //   position: 'right',
        // },

        {
          href: 'https://github.com/piscinajs/piscina',
          label: 'GitHub',
          position: 'right'
        }
      ]
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Quick Start',
          items: [
            {
              label: 'Getting started',
              to: '/getting-started/Installation'
            }
          ]
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Github',
              href: 'https://github.com/piscinajs/piscina'
            }
          ]
        }
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Piscina. Built with Docusaurus.`
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula
    }
  } satisfies Preset.ThemeConfig
};

export default config;
