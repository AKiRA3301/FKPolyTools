import { Layout, Menu } from 'antd';
import {
    DashboardOutlined,
    LineChartOutlined,
    SwapOutlined,
    WalletOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';

const { Sider } = Layout;

function Sidebar() {
    const navigate = useNavigate();
    const location = useLocation();

    const menuItems = [
        {
            key: '/dashboard',
            icon: <DashboardOutlined />,
            label: '仪表盘',
        },
        {
            key: '/markets',
            icon: <LineChartOutlined />,
            label: '市场',
        },
        {
            key: '/arbitrage',
            icon: <SwapOutlined />,
            label: '套利',
        },
        {
            key: '/wallets',
            icon: <WalletOutlined />,
            label: '钱包',
        },
        {
            key: '/whale',
            icon: <WalletOutlined />,
            label: '🐋 鲸鱼发现',
        },
    ];

    return (
        <Sider
            width={200}
            style={{
                background: '#1f1f1f',
                borderRight: '1px solid #333',
            }}
        >
            <Menu
                mode="inline"
                selectedKeys={[location.pathname]}
                style={{
                    background: 'transparent',
                    borderRight: 'none',
                    marginTop: 16,
                }}
                items={menuItems}
                onClick={({ key }) => navigate(key)}
            />
        </Sider>
    );
}

export default Sidebar;
