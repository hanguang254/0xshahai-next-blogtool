import React from 'react'
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    useDisclosure,
    useDraggable,
    Textarea
} from "@heroui/react";

import {Input} from "@heroui/input";

import {Card, CardBody, CardFooter, Image} from "@heroui/react";
import styles from "./index.module.css"

// 为不同的模态框创建不同的内容组件
const Monad1Content = ({ onClose ,...moveProps}) => {
    // 地址输入值获取
    const [inputValue, setInputValue] = React.useState("");
    //地址列表
    const [addresslist, setAddressList] = React.useState([]);
    // 判断有效
    const [isValid, setIsValid] = React.useState(true);
    const [errorMessage, setErrorMessage] = React.useState("");

    //获取输入的地址数组
    const handleAction = () => {
        const addresses = inputValue.split('\n').filter(addr => addr.trim());
        setAddressList(addresses);
        console.log("处理的地址列表:", addresses);
        // 这里添加你的处理逻辑
    };

    //验证地址是否正确
    const validateAddresses = (value: string) => {
        const addresses = value.split('\n');
        for (const address of addresses) {
            if (address.trim() && !address.match(/^0x[0-9a-fA-F]{40}$/)) {
                setIsValid(false);
                setErrorMessage("无效的以太坊地址");
                return false;
            }
        }
        setIsValid(true);
        setErrorMessage("");
        return true;
    };

    const handleInputChange = (e) => {
        const newValue = e.target.value;
        setInputValue(newValue);
        validateAddresses(newValue);
    };

    return (
        <>
            <ModalHeader {...moveProps} className="flex flex-col gap-1">
                MON合约分发工具
            </ModalHeader>
            <ModalBody>
                <Textarea
                    disableAnimation
                    // disableAutosize
                    // onClear={() => console.log("textarea cleared")}
                    classNames={{
                        base: "w-full",
                        input: "resize-y min-h-[80px]",
                    }}
                    label="地址栏"
                    placeholder="一行一个地址，建议每次分发50个地址"
                    variant="bordered"
                    minRows={8}
                    size='lg'
                    className="w-full"
                    value={inputValue}
                    onChange={handleInputChange}
                    isInvalid={!isValid}
                    errorMessage={errorMessage}
                    color={isValid ? "default" : "danger"}
                    isRequired={true}
                />
                <div>
                    <Input
                        
                        isRequired
                        label="分发数量"
                        labelPlacement="outside"
                        placeholder="0.00"
                        startContent={
                            <div className="pointer-events-none flex items-center">
                                <span className="text-default-400 text-small">$</span>
                            </div>
                        }
                        type="number"
                        min="0.01"
                        step="0.01"
                    />
                </div>
            </ModalBody>
            <ModalFooter className={styles.buttonContainer}>
                <Button color="primary"  onPress={onClose}>
                    存款
                </Button>
                <Button 
                    color="primary" 
                    onPress={handleAction}
                    isDisabled={!isValid || !inputValue.trim()}
                >
                    Action
                </Button>
            </ModalFooter>
        </>
    );
};

const Monad2Content = ({ onClose, ...moveProps }) => {
    return (
        <>
            <ModalHeader {...moveProps} className="flex flex-col gap-1">
                Monad 2 Details
            </ModalHeader>
            <ModalBody>
                <div>这是完全不同的内容</div>
                <Button color="secondary">其他操作</Button>
            </ModalBody>
            <ModalFooter>
                <Button color="danger" variant="light" onPress={onClose}>
                  Close
                </Button>
                <Button color="primary" onPress={onClose}>
                  Action
                </Button>
            </ModalFooter>
        </>
    );
};

const Monad3Content = ({ onClose,...moveProps }) => {
    return (
        <>
            <ModalHeader {...moveProps} className="flex flex-col gap-1">
                Monad 3 Details
            </ModalHeader>
            <ModalBody>
                <p>第三个模态框的独特内容</p>
                {/* 添加你想要的任何组件 */}
            </ModalBody>
            <ModalFooter>
                <Button color="danger" variant="light" onPress={onClose}>
                  Close
                </Button>
                <Button color="primary" onPress={onClose}>
                  Action
                </Button>
            </ModalFooter>
        </>
    );
};

export default function Monad() {
    const {isOpen, onOpen, onOpenChange} = useDisclosure();
    const targetRef = React.useRef(null);
    const {moveProps} = useDraggable({targetRef, isDisabled: !isOpen});

    const list = [
        {
            title: "合约分发水工具",
            img: "https://imagedelivery.net/cBNDGgkrsEA-b_ixIp9SkQ/MON.png/public",
            content: Monad1Content
        },
        {
            title: "Monad 2",
            img: "/images/fruit-1.jpeg",
            // price: "$5.50",
            content: Monad2Content
        },
        {
            title: "Monad 3",
            img: "/images/fruit-1.jpeg",
            // price: "$5.50",
            content: Monad3Content
        },
    ];

    const [selectedItem, setSelectedItem] = React.useState(null);

    const handleCardPress = (item) => {
        setSelectedItem(item);
        onOpen();
    };

    return (
        <>
        {/* <Button onPress={onOpen}>分发水</Button> */}
        
        <div className="gap-2 grid grid-cols-2 sm:grid-cols-4" >
            {list.map((item, index) => (
                /* eslint-disable no-console */
                <Card key={index} 
                isPressable 
                shadow="sm" 
                onPress={() => handleCardPress(item)}>
                <CardBody className="overflow-visible p-0">
                    <Image
                    alt={item.title}
                    className="w-full object-cover h-[140px]"
                    radius="lg"
                    shadow="sm"
                    src={item.img}
                    width="100%"
                    />
                </CardBody>
                <CardFooter className="text-small justify-center">
                    <b>{item.title}</b>
                    {/* <p className="text-default-500">{item.price}</p> */}
                </CardFooter>
                </Card>
            ))}
        </div>
        {/* 可移动模态框 */}
        <Modal 
            ref={targetRef} 
            isOpen={isOpen} 
            onOpenChange={onOpenChange}
            isDismissable={false}
            placement="center"
            size='3xl'
        >
            <ModalContent>
                {(onClose) => (
                    selectedItem?.content && <selectedItem.content onClose={onClose} {...moveProps} />
                )}
            </ModalContent>
        </Modal>
        </>
    )
}
