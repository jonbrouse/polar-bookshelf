import * as React from 'react';
import {Subject} from "rxjs";
import {SnapshotSubscriber} from "polar-shared/src/util/Snapshots";
import {useComponentWillUnmount} from "../../../../web/js/hooks/ReactLifecycleHooks";
import {useCachedSnapshotSubscriber} from "../../../../web/js/react/CachedSnapshotSubscriber";

export interface ISnapshot<V> {

    /**
     * The actual underlying value.
     */
    readonly value: V | undefined;

    /**
     * True if the snapshot exists in the database.  Used to disambiguate a null
     * or undefined value that was stored vs just a missing value.
     */
    readonly exists: boolean;

    /**
     * The source of the snapshot (cache or server). Mostly for debug purposes.
     */
    readonly source: 'cache' | 'server';

}

interface ICachedSnapshotContext<V> {

    /**
     * The underlying rxjs observable for sending off updates to components.
     */
    readonly subject: Subject<ISnapshot<V>>;

    /**
     * The current value, used for the the initial render of each component
     * and to update it each time so that on useObservableStore we can
     * return the current value.
     */
    current: ISnapshot<V> | undefined;

}

interface ProviderProps<V> {
    readonly id: string;
    readonly snapshotSubscriber: SnapshotSubscriber<ISnapshot<V>>;
    readonly children: JSX.Element;
}

export type CacheProviderComponent<V> = (props: ProviderProps<V>) => JSX.Element;
export type UseSnapshotHook<V> = () => ISnapshot<V>;

export type CachedSnapshotTuple<V> = [
    CacheProviderComponent<V>,
    UseSnapshotHook<V>
];

/**
 * The underlying value 'V' can be undefined in which case 'exists' will be false.
 *
 * Note that if the user defines V as something like string | undefined the value
 * itself could be set to undefined in the database but then exists would be true.
 *
 * However, we do not call render 'children' until we have the first snapshot.
 */
export function createCachedSnapshotSubscriber<V>(): CachedSnapshotTuple<V> {

    const subject = new Subject<ISnapshot<V>>();

    const initialContext: ICachedSnapshotContext<V> = {
        subject,
        current: undefined
    }

    const context = React.createContext<ICachedSnapshotContext<V>>(initialContext);

    /**
     * This component gets the context, then starts listening to it and
     * unsubscribes on component unmount.
     */
    const useSnapshot: UseSnapshotHook<V> = () => {

        const storeContext = React.useContext(context);
        const [value, setValue] = React.useState<ISnapshot<V> | undefined>(storeContext.current);

        const subscriptionRef = React.useRef(storeContext.subject.subscribe(setValue));

        useComponentWillUnmount(() => {
            if (subscriptionRef.current) {
                subscriptionRef.current.unsubscribe();
            }
        })

        // the value can never be undefined as we're only returning once we have
        // the first value
        return value!;

    };

    const ProviderDelegate = (props: ProviderProps<V>) => {

        const storeContext = React.useContext(context);
        const value = useCachedSnapshotSubscriber({id: props.id, subscriber: props.snapshotSubscriber})
        storeContext.current = value;
        storeContext.subject.next(value);

        if (storeContext.current !== undefined) {
            return props.children;
        } else {
            return null;
        }

    }

    const Provider = (props: ProviderProps<V>) => {

        return (

            <context.Provider value={initialContext}>
                <ProviderDelegate id={props.id}
                                  snapshotSubscriber={props.snapshotSubscriber}>
                    {props.children}
                </ProviderDelegate>
            </context.Provider>

        );

    }

    return [Provider, useSnapshot];

}