export default function useDebouncedEffect<T>(value: T, delay: number, callback: (value: T) => void) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  const isFirst = useRef(true)

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false
      return
    }
    const timeoutId = setTimeout(() => callbackRef.current(value), delay)
    return () => clearTimeout(timeoutId)
  }, [value, delay])
}
