// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Stripe} from '@stripe/stripe-js';
import {FormattedMessage} from 'react-intl';
import {RouteComponentProps, withRouter} from 'react-router-dom';

import {BillingDetails} from 'types/cloud/sku';
import {pageVisited, trackEvent} from 'actions/telemetry_actions';
import {TELEMETRY_CATEGORIES} from 'utils/constants';

import {t} from 'utils/i18n';
import {getNextBillingDate} from 'utils/utils';

import CreditCardSvg from 'components/common/svg_images_components/credit_card_svg';
import PaymentSuccessStandardSvg from 'components/common/svg_images_components/payment_success_standard_svg';
import PaymentFailedSvg from 'components/common/svg_images_components/payment_failed_svg';

import {Product} from '@mattermost/types/cloud';

import IconMessage from './icon_message';

import './process_payment.css';

type Props = RouteComponentProps & {
    billingDetails: BillingDetails | null;
    stripe: Promise<Stripe | null>;
    isDevMode: boolean;
    contactSupportLink: string;
    addPaymentMethod: (stripe: Stripe, billingDetails: BillingDetails, isDevMode: boolean) => Promise<boolean | null>;
    subscribeCloudSubscription: ((productId: string) => Promise<boolean | null>) | null;
    onBack: () => void;
    onClose: () => void;
    selectedProduct?: Product | null | undefined;
    currentProduct?: Product | null | undefined;
    isProratedPayment?: boolean;
    isUpgradeFromTrial: boolean;
    setIsUpgradeFromTrialToFalse: () => void;
}

type State = {
    progress: number;
    error: boolean;
    state: ProcessState;
}

enum ProcessState {
    PROCESSING = 0,
    SUCCESS,
    FAILED
}

const MIN_PROCESSING_MILLISECONDS = 5000;
const MAX_FAKE_PROGRESS = 95;

class ProcessPaymentSetup extends React.PureComponent<Props, State> {
    intervalId: NodeJS.Timeout;

    public constructor(props: Props) {
        super(props);

        this.intervalId = {} as NodeJS.Timeout;

        this.state = {
            progress: 0,
            error: false,
            state: ProcessState.PROCESSING,
        };
    }

    public componentDidMount() {
        this.savePaymentMethod();

        this.intervalId = setInterval(this.updateProgress, MIN_PROCESSING_MILLISECONDS / MAX_FAKE_PROGRESS);
    }

    public componentWillUnmount() {
        clearInterval(this.intervalId);
    }

    private updateProgress = () => {
        let {progress} = this.state;

        if (progress >= MAX_FAKE_PROGRESS) {
            clearInterval(this.intervalId);
            return;
        }

        progress += 1;
        this.setState({progress: progress > MAX_FAKE_PROGRESS ? MAX_FAKE_PROGRESS : progress});
    }

    private savePaymentMethod = async () => {
        const start = new Date();
        const {
            stripe,
            addPaymentMethod,
            billingDetails,
            isDevMode,
            subscribeCloudSubscription,
        } = this.props;
        const success = await addPaymentMethod((await stripe)!, billingDetails!, isDevMode);

        if (!success) {
            this.setState({
                error: true,
                state: ProcessState.FAILED});
            return;
        }

        if (subscribeCloudSubscription) {
            const productUpdated = await subscribeCloudSubscription(this.props.selectedProduct?.id as string);

            // the action subscribeCloudSubscription returns a true boolean when successful and an error when it fails
            if (typeof productUpdated !== 'boolean') {
                this.setState({
                    error: true,
                    state: ProcessState.FAILED});
                return;
            }
        }

        const end = new Date();
        const millisecondsElapsed = end.valueOf() - start.valueOf();
        if (millisecondsElapsed < MIN_PROCESSING_MILLISECONDS) {
            setTimeout(this.completePayment, MIN_PROCESSING_MILLISECONDS - millisecondsElapsed);
            return;
        }

        this.completePayment();
    }

    private completePayment = () => {
        clearInterval(this.intervalId);
        trackEvent('cloud_admin', 'complete_payment_success');
        this.setState({state: ProcessState.SUCCESS, progress: 100});
    }

    private handleGoBack = () => {
        clearInterval(this.intervalId);
        this.setState({
            progress: 0,
            error: false,
            state: ProcessState.PROCESSING,
        });
        this.props.onBack();
    }

    private sucessPage = () => {
        const {error} = this.state;
        if (this.props.isProratedPayment) {
            const formattedButonText = (
                <FormattedMessage
                    defaultMessage='Return to Workspace'
                    id='admin.billing.subscription.returnToWorkspace'
                />
            );
            const formattedTitle = (
                <FormattedMessage
                    defaultMessage={'You are now subscribed to {selectedProductName}'}
                    id={'admin.billing.subscription.proratedPayment.title'}
                    values={{selectedProductName: this.props.selectedProduct?.name}}
                />
            );
            const formattedSubtitle = (
                <FormattedMessage
                    defaultMessage={"Thank you for upgrading to {selectedProductName}. Check your workspace in a few minutes to access all the plan's features. You'll be charged a prorated amount for your {currentProductName} plan and {selectedProductName} plan based on the number of days left in the billing cycle and number of users you have."}
                    id={'admin.billing.subscription.proratedPayment.substitle'}
                    values={{selectedProductName: this.props.selectedProduct?.name, currentProductName: this.props.currentProduct?.name}}
                />
            );
            return (
                <>
                    <IconMessage
                        formattedTitle={formattedTitle}
                        formattedSubtitle={formattedSubtitle}
                        date={getNextBillingDate()}
                        error={error}
                        icon={
                            <PaymentSuccessStandardSvg
                                width={444}
                                height={313}
                            />
                        }
                        formattedButonText={formattedButonText}
                        buttonHandler={this.props.onClose}
                        className={'success'}
                    />
                </>
            );
        }
        const productName = this.props.selectedProduct?.name;
        const title = (
            <FormattedMessage
                id={'admin.billing.subscription.upgradedSuccess'}
                defaultMessage={'You\'ve are now upgraded to {productName}'}
                values={{productName}}
            />
        );

        let handleClose = () => {
            this.props.onClose();
        };

        // if is the first purchase, show a different success purchasing title
        if (this.props.isUpgradeFromTrial) {
            handleClose = () => {
                // set the property isUpgrading to false onClose since we can not use directly isFreeTrial because of component rerendering
                this.props.setIsUpgradeFromTrialToFalse();
                this.props.onClose();
            };
        }

        const formattedSubtitle = (
            <FormattedMessage
                id='admin.billing.subscription.nextBillingDate'
                defaultMessage='Starting from {date}, you will be billed for the {productName} plan. You can change your plan whenever you like and we will pro-rate the charges.'
                values={{date: getNextBillingDate(), productName}}
            />
        );
        return (
            <IconMessage
                formattedTitle={title}
                formattedSubtitle={formattedSubtitle}
                error={error}
                icon={
                    <PaymentSuccessStandardSvg
                        width={444}
                        height={313}
                    />
                }
                buttonText={t('admin.billing.subscription.returnToWorkspace')}
                buttonHandler={handleClose}
                className={'success'}
                linkText={t('admin.billing.subscription.viewBilling')}
                linkHandler={() => {
                    this.props.onClose();
                    this.props.history.push('/admin_console/billing/subscription');
                }}
            />
        );
    }

    public render() {
        const {state, progress, error} = this.state;

        const progressBar: JSX.Element | null = (
            <div className='ProcessPayment-progress'>
                <div
                    className='ProcessPayment-progress-fill'
                    style={{width: `${progress}%`}}
                />
            </div>
        );

        switch (state) {
        case ProcessState.PROCESSING:
            return (
                <IconMessage
                    title={t('admin.billing.subscription.verifyPaymentInformation')}
                    subtitle={''}
                    icon={
                        <CreditCardSvg
                            width={444}
                            height={313}
                        />
                    }
                    footer={progressBar}
                    className={'processing'}
                />
            );
        case ProcessState.SUCCESS:
            pageVisited(
                TELEMETRY_CATEGORIES.CLOUD_PURCHASING,
                'pageview_payment_success',
            );
            return this.sucessPage();
        case ProcessState.FAILED:
            pageVisited(
                TELEMETRY_CATEGORIES.CLOUD_PURCHASING,
                'pageview_payment_failed',
            );
            return (
                <IconMessage
                    title={t('admin.billing.subscription.paymentVerificationFailed')}
                    subtitle={t('admin.billing.subscription.paymentFailed')}
                    icon={
                        <PaymentFailedSvg
                            width={444}
                            height={313}
                        />
                    }
                    error={error}
                    buttonText={t('admin.billing.subscription.goBackTryAgain')}
                    buttonHandler={this.handleGoBack}
                    linkText={t('admin.billing.subscription.privateCloudCard.contactSupport')}
                    linkURL={this.props.contactSupportLink}
                    className={'failed'}
                />
            );
        default:
            return null;
        }
    }
}

export default withRouter(ProcessPaymentSetup);

