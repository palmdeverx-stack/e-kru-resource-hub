'use client';

import { useQuery } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { useTranslate } from 'src/locales';
import { apiFetch as fetch } from 'src/lib/api-fetch';

import {
  RiBankLine,
  RiUserLine,
  RiStore2Line,
  RiRefreshLine,
  RiMessage2Line,
  RiFileList3Line,
  RiSettings3Line,
  RiShieldStarLine,
  RiArrowRightLine,
  RiShieldCheckLine,
  RiShoppingBag3Line,
  RiMoneyDollarCircleLine,
} from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { formatPrice } from '../../shared/api';

type AdminOverview = {
  setupRequired?: boolean;
  metrics: {
    grossSales: number;
    platformRevenue: number;
    sellerRevenue: number;
    pendingPayoutAmount: number;
    orderCount: number;
    activeSellerCount: number;
    publishedProductCount: number;
    marketplaceUserCount: number;
  };
  attention: {
    pendingSellerCount: number;
    pendingProductCount: number;
    pendingPaymentCount: number;
    pendingPayoutCount: number;
    pendingOrderCount: number;
  };
  recentSellers: Array<{
    id: string;
    display_name: string;
    seller_type: 'individual' | 'teacher' | 'school' | 'company' | 'publisher' | 'university';
    status: string;
    logo_url: string | null;
    submitted_at: string | null;
    created_at: string;
  }>;
  recentOrders: Array<{
    id: string;
    total: number;
    currency: string;
    status: string;
    created_at: string;
    seller: { display_name: string } | null;
  }>;
};

const sellerTypeLabel = {
  individual: 'dashboardUi.individual',
  teacher: 'dashboardUi.teacher',
  school: 'dashboardUi.school',
  company: 'dashboardUi.company',
  publisher: 'dashboardUi.publisher',
  university: 'dashboardUi.university',
};

const orderStatus: Record<
  string,
  { label: string; color: 'default' | 'warning' | 'info' | 'success' | 'error' }
> = {
  pending: { label: 'dashboardUi.pending', color: 'warning' },
  pending_payment: { label: 'dashboardUi.awaitingPayment', color: 'warning' },
  payment_review: { label: 'dashboardUi.paymentReview', color: 'info' },
  payment_rejected: { label: 'dashboardUi.paymentRejected', color: 'error' },
  paid: { label: 'dashboardUi.paidLabel', color: 'success' },
  completed: { label: 'dashboardUi.completed', color: 'success' },
  cancelled: { label: 'dashboardUi.cancelled', color: 'default' },
  refunded: { label: 'dashboardUi.refunded', color: 'error' },
};

export function MarketplaceAdminOverviewView() {
  const { t, currentLang } = useTranslate('marketplace');
  const { user } = useAuthContext();
  const {
    data: overview,
    isPending: loading,
    isFetching,
    error: loadError,
    dataUpdatedAt,
    refetch,
  } = useQuery<AdminOverview>({
    queryKey: ['admin-overview', user?.id, user?.role],
    enabled: Boolean(user?.id) && ['master_admin', 'marketplace_admin'].includes(user?.role),
    staleTime: 0,
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/marketplace/admin/overview', {
        cache: 'no-store',
        signal,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      return result;
    },
  });
  const error = loadError?.message ?? '';
  const refreshing = isFetching && !loading;
  const updatedAt = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  if (user?.role !== 'master_admin' && user?.role !== 'marketplace_admin') {
    return (
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Alert severity="error">
          {t('dashboardUi.thisPageIsForMarketplaceAdministratorsOnly')}
        </Alert>
      </Container>
    );
  }

  const metrics = overview
    ? [
        {
          label: t('dashboardUi.grossSales'),
          value: formatPrice(overview.metrics.grossSales, 'THB', currentLang.numberFormat.code),
          description: t('dashboardUi.paidOrders'),
          icon: RiMoneyDollarCircleLine,
          color: 'success.main',
          background: 'success.lighter',
        },
        {
          label: t('dashboardUi.platformRevenue'),
          value: formatPrice(
            overview.metrics.platformRevenue,
            'THB',
            currentLang.numberFormat.code
          ),
          description: t('dashboardUi.netFees'),
          icon: RiBankLine,
          color: 'primary.main',
          background: 'primary.lighter',
        },
        {
          label: t('dashboardUi.allOrders'),
          value: overview.metrics.orderCount.toLocaleString(currentLang.numberFormat.code),
          description: t('dashboardUi.pendingOrders', {
            count: overview.attention.pendingOrderCount,
            formattedCount: overview.attention.pendingOrderCount.toLocaleString(
              currentLang.numberFormat.code
            ),
          }),
          icon: RiShoppingBag3Line,
          color: 'info.main',
          background: 'info.lighter',
        },
        {
          label: t('dashboardUi.activeStores'),
          value: overview.metrics.activeSellerCount.toLocaleString(currentLang.numberFormat.code),
          description: t('dashboardUi.pendingStores', {
            count: overview.attention.pendingSellerCount,
            formattedCount: overview.attention.pendingSellerCount.toLocaleString(
              currentLang.numberFormat.code
            ),
          }),
          icon: RiStore2Line,
          color: 'warning.main',
          background: 'warning.lighter',
        },
        {
          label: t('dashboardUi.publishedResources'),
          value: overview.metrics.publishedProductCount.toLocaleString(
            currentLang.numberFormat.code
          ),
          description: t('dashboardUi.pendingProducts', {
            count: overview.attention.pendingProductCount,
            formattedCount: overview.attention.pendingProductCount.toLocaleString(
              currentLang.numberFormat.code
            ),
          }),
          icon: RiFileList3Line,
          color: 'secondary.main',
          background: 'secondary.lighter',
        },
        {
          label: t('dashboardUi.marketplaceMembers'),
          value: overview.metrics.marketplaceUserCount.toLocaleString(
            currentLang.numberFormat.code
          ),
          description: t('dashboardUi.allUserAccounts'),
          icon: RiUserLine,
          color: 'error.main',
          background: 'error.lighter',
        },
      ]
    : [];

  return (
    <Container maxWidth={false} sx={{ py: { xs: 3 } }}>
      <Card
        variant="outlined"
        sx={{
          p: { xs: 3, md: 4 },
          overflow: 'hidden',
          position: 'relative',
          borderColor: 'primary.lighter',
          background:
            'linear-gradient(115deg, rgba(8,84,216,0.10), rgba(255,255,255,0.98) 48%, rgba(44,168,255,0.08))',
          '&::after': {
            content: '""',
            width: 220,
            height: 220,
            top: -120,
            right: -50,
            borderRadius: '50%',
            position: 'absolute',
            bgcolor: 'primary.main',
            opacity: 0.07,
          },
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ md: 'center' }}
          justifyContent="space-between"
          spacing={3}
          sx={{ position: 'relative', zIndex: 1 }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar
              variant="rounded"
              sx={{
                width: 64,
                height: 64,
                color: 'common.white',
                bgcolor: 'primary.main',
                boxShadow: '0 10px 24px rgba(8,84,216,0.25)',
              }}
            >
              <RiShieldStarLine size={32} />
            </Avatar>
            <Box>
              <Typography component="h1" variant="h3">
                {t('dashboardUi.marketplaceControlCenter')}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                {t('dashboardUi.trackApprovalsPaymentsAndPlatformOperations')}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                <Chip size="small" color="primary" variant="soft" label="SUPER ADMIN" />
                {!!updatedAt && (
                  <Typography variant="caption" color="text.secondary">
                    {t('dashboardUi.lastUpdated')}{' '}
                    {updatedAt.toLocaleTimeString(currentLang.numberFormat.code, {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'Asia/Bangkok',
                    })}
                  </Typography>
                )}
              </Stack>
            </Box>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              component={RouterLink}
              href={paths.marketplace.sellerApprovals}
              variant="outlined"
              startIcon={<RiStore2Line />}
            >
              {t('dashboardUi.reviewStoreApplications')}
            </Button>
            <Button
              component={RouterLink}
              href={paths.marketplace.productApprovals}
              variant="contained"
              startIcon={<RiShieldCheckLine />}
            >
              {t('dashboardUi.reviewResources')}
            </Button>
            <Button
              color="inherit"
              variant="outlined"
              loading={refreshing}
              startIcon={<RiRefreshLine />}
              onClick={() => refetch()}
            >
              {t('dashboardUi.refresh')}
            </Button>
          </Stack>
        </Stack>
      </Card>

      {!!error && (
        <Alert severity="error" sx={{ mt: 3 }}>
          {error}
        </Alert>
      )}
      {overview?.setupRequired && (
        <Alert severity="warning" sx={{ mt: 3 }}>
          {t('dashboardUi.theMarketplaceSchemaHasNotBeenInstalledIn')}
        </Alert>
      )}

      {loading ? (
        <Grid container spacing={2} sx={{ mt: 3 }}>
          {Array.from({ length: 6 }).map((_, index) => (
            <Grid key={index} size={{ xs: 12, sm: 6, lg: 2 }}>
              <Skeleton variant="rounded" height={156} />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Grid container spacing={2} sx={{ mt: 3 }}>
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <Grid key={metric.label} size={{ xs: 12, sm: 6, lg: 2 }}>
                <Card
                  variant="outlined"
                  sx={{
                    p: 2.5,
                    height: 1,
                    transition: 'transform 160ms ease, box-shadow 160ms ease',
                    '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Typography color="text.secondary" variant="body2">
                      {metric.label}
                    </Typography>
                    <Avatar
                      variant="rounded"
                      sx={{
                        width: 38,
                        height: 38,
                        color: metric.color,
                        bgcolor: metric.background,
                      }}
                    >
                      <Icon size={20} />
                    </Avatar>
                  </Stack>
                  <Typography variant="h4" sx={{ mt: 1.25 }}>
                    {metric.value}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {metric.description}
                  </Typography>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {overview && !overview.setupRequired && (
        <>
          <AttentionPanel overview={overview} />

          <Grid container spacing={3} sx={{ mt: 0 }}>
            <Grid size={{ xs: 12, lg: 8 }}>
              <RecentOrders orders={overview.recentOrders} />
            </Grid>
            <Grid size={{ xs: 12, lg: 4 }}>
              <FinanceSummary overview={overview} />
            </Grid>
            <Grid size={{ xs: 12, lg: 7 }}>
              <RecentSellers sellers={overview.recentSellers} />
            </Grid>
            <Grid size={{ xs: 12, lg: 5 }}>
              <QuickActions />
            </Grid>
          </Grid>
        </>
      )}
    </Container>
  );
}

function AttentionPanel({ overview }: { overview: AdminOverview }) {
  const { t, currentLang } = useTranslate('marketplace');
  const items = [
    {
      label: t('dashboardUi.storesAwaitingReview'),
      description: t('dashboardUi.reviewSellerInformationAndDocuments'),
      value: overview.attention.pendingSellerCount,
      href: paths.marketplace.sellerApprovals,
      icon: RiStore2Line,
      color: 'warning.main',
      background: 'warning.lighter',
    },
    {
      label: t('dashboardUi.resourcesAwaitingApproval'),
      description: t('dashboardUi.reviewQualityAndCopyright'),
      value: overview.attention.pendingProductCount,
      href: paths.marketplace.productApprovals,
      icon: RiFileList3Line,
      color: 'info.main',
      background: 'info.lighter',
    },
    {
      label: t('dashboardUi.paymentsAwaitingReview'),
      description: t('dashboardUi.verifyReceivedPayments'),
      value: overview.attention.pendingPaymentCount,
      href: paths.marketplace.paymentReviews,
      icon: RiBankLine,
      color: 'error.main',
      background: 'error.lighter',
    },
    {
      label: t('dashboardUi.pendingPayouts'),
      description: t('dashboardUi.manageSellerPayoutCycles'),
      value: overview.attention.pendingPayoutCount,
      href: paths.marketplace.payouts,
      icon: RiMoneyDollarCircleLine,
      color: 'success.main',
      background: 'success.lighter',
    },
  ];
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, my: 3 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        spacing={1}
        sx={{ mb: 2.5 }}
      >
        <Box>
          <Typography variant="h6">{t('dashboardUi.actionRequired')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('dashboardUi.itemsAwaitingAdministratorReviewAndApproval')}
          </Typography>
        </Box>
        <Chip
          color={total ? 'warning' : 'success'}
          variant="soft"
          label={
            total
              ? t('dashboardUi.pendingTasks', {
                  count: total,
                  formattedCount: total.toLocaleString(currentLang.numberFormat.code),
                })
              : t('dashboardUi.noPendingTasks')
          }
        />
      </Stack>
      <Grid container spacing={2}>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Grid key={item.label} size={{ xs: 12, sm: 6, lg: 3 }}>
              <Box
                component={RouterLink}
                href={item.href}
                sx={{
                  p: 2,
                  gap: 1.5,
                  color: 'text.primary',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  display: 'flex',
                  textDecoration: 'none',
                  alignItems: 'center',
                  transition: 'border-color 160ms ease, background-color 160ms ease',
                  '&:hover': { borderColor: item.color, bgcolor: 'action.hover' },
                }}
              >
                <Avatar
                  variant="rounded"
                  sx={{ color: item.color, bgcolor: item.background, flexShrink: 0 }}
                >
                  <Icon size={21} />
                </Avatar>
                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                    <Typography variant="subtitle2" noWrap>
                      {item.label}
                    </Typography>
                    <Typography variant="h6">{item.value}</Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" noWrap display="block">
                    {item.description}
                  </Typography>
                </Box>
                <RiArrowRightLine size={18} />
              </Box>
            </Grid>
          );
        })}
      </Grid>
    </Card>
  );
}

function RecentOrders({ orders }: { orders: AdminOverview['recentOrders'] }) {
  const { t, currentLang } = useTranslate('marketplace');
  return (
    <Card variant="outlined" sx={{ p: 3, height: 1 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="h6">{t('dashboardUi.recentOrders')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('dashboardUi.latestMarketplaceTransactions')}
          </Typography>
        </Box>
        <Avatar variant="rounded" sx={{ color: 'info.main', bgcolor: 'info.lighter' }}>
          <RiShoppingBag3Line />
        </Avatar>
      </Stack>
      <Stack divider={<Divider flexItem />} sx={{ mt: 2 }}>
        {orders.length ? (
          orders.map((order) => {
            const status = orderStatus[order.status] ?? {
              label: order.status,
              color: 'default' as const,
            };
            return (
              <Stack
                key={order.id}
                direction="row"
                spacing={2}
                alignItems="center"
                sx={{ py: 1.5 }}
              >
                <Avatar sx={{ width: 40, height: 40, bgcolor: 'action.hover' }}>
                  <RiShoppingBag3Line size={19} />
                </Avatar>
                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                  <Typography variant="subtitle2" noWrap>
                    {order.seller?.display_name ??
                      t('dashboardUi.orderNumber', { id: order.id.slice(0, 8) })}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    #{order.id.slice(0, 8).toUpperCase()} ·{' '}
                    {new Date(order.created_at).toLocaleString(currentLang.numberFormat.code, {
                      timeZone: 'Asia/Bangkok',
                    })}
                  </Typography>
                </Box>
                <Typography variant="subtitle2">
                  {formatPrice(Number(order.total), order.currency, currentLang.numberFormat.code)}
                </Typography>
                <Chip
                  size="small"
                  variant="soft"
                  color={status.color}
                  label={t(status.label, { defaultValue: status.label })}
                />
              </Stack>
            );
          })
        ) : (
          <EmptyState
            label={t('dashboardUi.noOrdersYet')}
            icon={<RiShoppingBag3Line size={30} />}
          />
        )}
      </Stack>
    </Card>
  );
}

function FinanceSummary({ overview }: { overview: AdminOverview }) {
  const { t, currentLang } = useTranslate('marketplace');
  const items = [
    [t('dashboardUi.paidSales'), overview.metrics.grossSales],
    [t('dashboardUi.totalSellerRevenue'), overview.metrics.sellerRevenue],
    [t('dashboardUi.netPlatformRevenue'), overview.metrics.platformRevenue],
    [t('dashboardUi.amountInPendingPayouts'), overview.metrics.pendingPayoutAmount],
  ] as const;

  return (
    <Card
      variant="outlined"
      sx={{
        p: 3,
        height: 1,
        color: 'common.white',
        border: 0,
        background: 'linear-gradient(145deg, #102A56 0%, #0754D8 100%)',
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h6">{t('dashboardUi.financialOverview')}</Typography>
          <Typography variant="body2" sx={{ opacity: 0.72 }}>
            {t('dashboardUi.marketplaceTotals')}
          </Typography>
        </Box>
        <Avatar sx={{ bgcolor: '#ffff' }}>
          <RiMoneyDollarCircleLine />
        </Avatar>
      </Stack>
      <Stack
        divider={<Divider flexItem sx={{ borderColor: 'rgba(255,255,255,0.14)' }} />}
        sx={{ mt: 2 }}
      >
        {items.map(([label, value]) => (
          <Stack key={label} direction="row" justifyContent="space-between" sx={{ py: 1.6 }}>
            <Typography variant="body2" sx={{ opacity: 0.78 }}>
              {label}
            </Typography>
            <Typography variant="subtitle2">
              {formatPrice(value, 'THB', currentLang.numberFormat.code)}
            </Typography>
          </Stack>
        ))}
      </Stack>
      <Button
        component={RouterLink}
        href={paths.marketplace.payouts}
        fullWidth
        variant="contained"
        color="inherit"
        endIcon={<RiArrowRightLine />}
        sx={{ mt: 2, color: 'primary.darker', bgcolor: 'common.white' }}
      >
        {t('dashboardUi.managePayouts')}
      </Button>
    </Card>
  );
}

function RecentSellers({ sellers }: { sellers: AdminOverview['recentSellers'] }) {
  const { t, currentLang } = useTranslate('marketplace');
  return (
    <Card variant="outlined" sx={{ p: 3, height: 1 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="h6">{t('dashboardUi.recentSellers')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('dashboardUi.latestStoreApplications')}
          </Typography>
        </Box>
        <Button
          component={RouterLink}
          href={paths.marketplace.sellerApprovals}
          size="small"
          endIcon={<RiArrowRightLine />}
        >
          {t('dashboardUi.viewAll')}
        </Button>
      </Stack>
      <Stack divider={<Divider flexItem />} sx={{ mt: 2 }}>
        {sellers.length ? (
          sellers.map((seller) => (
            <Stack
              key={seller.id}
              component={RouterLink}
              href={paths.marketplace.sellerApproval(seller.id)}
              direction="row"
              spacing={1.5}
              alignItems="center"
              sx={{
                py: 1.5,
                color: 'text.primary',
                textDecoration: 'none',
                '&:hover': { color: 'primary.main' },
              }}
            >
              <Avatar
                src={seller.logo_url ?? undefined}
                variant="rounded"
                sx={{ bgcolor: 'warning.lighter', color: 'warning.main' }}
              >
                <RiStore2Line size={20} />
              </Avatar>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="subtitle2" noWrap>
                  {seller.display_name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t(sellerTypeLabel[seller.seller_type])} ·{' '}
                  {new Date(seller.submitted_at ?? seller.created_at).toLocaleDateString(
                    currentLang.numberFormat.code,
                    {
                      timeZone: 'Asia/Bangkok',
                    }
                  )}
                </Typography>
              </Box>
              <Chip
                label={
                  seller.status === 'active'
                    ? t('dashboardUi.approved')
                    : seller.status === 'rejected'
                      ? t('dashboardUi.rejected')
                      : t('dashboardUi.awaitingReview')
                }
                color={
                  seller.status === 'active'
                    ? 'success'
                    : seller.status === 'rejected'
                      ? 'error'
                      : 'warning'
                }
                size="small"
                variant="soft"
              />
              <RiArrowRightLine size={18} />
            </Stack>
          ))
        ) : (
          <EmptyState label={t('dashboardUi.noSellersYet')} icon={<RiStore2Line size={30} />} />
        )}
      </Stack>
    </Card>
  );
}

function QuickActions() {
  const { t } = useTranslate('marketplace');
  const actions = [
    {
      label: t('dashboardUi.reviewStoreApplications'),
      description: t('dashboardUi.sellerInformationAndDocuments'),
      href: paths.marketplace.sellerApprovals,
      icon: RiStore2Line,
    },
    {
      label: t('dashboardUi.reviewResourceSubmissions'),
      description: t('dashboardUi.resourceQualityAndCopyright'),
      href: paths.marketplace.productApprovals,
      icon: RiShieldCheckLine,
    },
    {
      label: t('dashboardUi.reviewPayments'),
      description: t('dashboardUi.reviewPaymentSlipsAndVerifyAmounts'),
      href: paths.marketplace.paymentReviews,
      icon: RiBankLine,
    },
    {
      label: t('dashboardUi.lineSettings'),
      description: t('dashboardUi.administratorNotifications'),
      href: paths.marketplace.lineSettings,
      icon: RiMessage2Line,
    },
    {
      label: t('dashboardUi.financeSettings'),
      description: t('dashboardUi.feesAndPayoutCycles'),
      href: paths.marketplace.financeSettings,
      icon: RiSettings3Line,
    },
  ];

  return (
    <Card variant="outlined" sx={{ p: 3, height: 1 }}>
      <Typography variant="h6">{t('dashboardUi.administratorShortcuts')}</Typography>
      <Typography variant="body2" color="text.secondary">
        {t('dashboardUi.quickAccessToCommonManagementTasks')}
      </Typography>
      <Box
        sx={{
          gap: 1.5,
          mt: 2,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
        }}
      >
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Box
              key={action.label}
              component={RouterLink}
              href={action.href}
              sx={{
                p: 1.75,
                gap: 1.25,
                color: 'text.primary',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                display: 'flex',
                textDecoration: 'none',
                alignItems: 'center',
                '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.lighter' },
              }}
            >
              <Avatar
                variant="rounded"
                sx={{ width: 38, height: 38, color: 'primary.main', bgcolor: 'primary.lighter' }}
              >
                <Icon size={19} />
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" noWrap>
                  {action.label}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap display="block">
                  {t(action.description)}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Card>
  );
}

function EmptyState({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <Stack alignItems="center" spacing={1} sx={{ py: 5, color: 'text.secondary' }}>
      {icon}
      <Typography variant="body2">{label}</Typography>
    </Stack>
  );
}
